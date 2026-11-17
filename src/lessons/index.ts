import manifest from 'virtual:lesson-manifest';
import type { Book, Chapter, Lesson, LessonMeta } from '../engine/types';

/**
 * The course map, ordered from zero to advanced. Order and contents follow docs/ROADMAP.md.
 *
 * Each entry is [lesson id, title]. A lesson goes live by itself as soon as the file
 * src/lessons/<id>.ts exists and exports a `Lesson` with that id. Until then the entry shows on
 * the map as planned. Nothing else needs editing to publish a lesson.
 */
type Entry = [id: string, title: string];
interface ChapterDef {
  id: string;
  title: string;
  entries: Entry[];
}
interface BookDef {
  id: string;
  title: string;
  subtitle: string;
  chapters: ChapterDef[];
}

const PATH: BookDef[] = [
  {
    id: 'core',
    title: 'Core path',
    subtitle: 'From how one request travels to designing whole systems. Follow it in order.',
    chapters: [
      {
        id: 'prerequisites',
        title: 'Prerequisites',
        entries: [
          ['what-is-system-design', 'What system design is'],
          ['networking-basics', 'Networking basics: IP, ports, TCP, UDP'],
          ['http-tls', 'HTTP, HTTPS and TLS'],
          ['dns', 'DNS in depth'],
        ],
      },
      {
        id: 'foundations',
        title: 'Foundations',
        entries: [
          ['request-lifecycle', 'How a request travels'],
          ['latency-numbers', 'Latency numbers'],
          ['latency-percentiles', 'Latency, throughput and percentiles'],
          ['napkin-math', 'Napkin math: capacity estimation'],
          ['availability', 'Availability in numbers: nines, SLA, SLO'],
          ['scaling-levers', 'Scaling up, scaling out, five levers'],
          ['design-framework', 'A framework for any design'],
        ],
      },
      {
        id: 'traffic',
        title: 'Scaling and traffic',
        entries: [
          ['load-balancing', 'Load balancing'],
          ['api-gateway', 'Reverse proxies and API gateways'],
          ['caching', 'Caching'],
          ['cdn', 'Content delivery networks'],
          ['rate-limiting', 'Rate limiting'],
          ['service-discovery', 'Service discovery and health checks'],
          ['multi-region', 'Multi-region and geo routing'],
        ],
      },
      {
        id: 'data',
        title: 'Data',
        entries: [
          ['sql-nosql', 'SQL and the NoSQL families'],
          ['indexes', 'Indexes and query tuning'],
          ['transactions', 'Transactions and isolation levels'],
          ['storage-engines', 'Storage engines: B-tree, LSM tree, WAL'],
          ['data-modeling', 'Data modeling and materialized views'],
          ['replication', 'Replication'],
          ['sharding', 'Sharding'],
          ['consistent-hashing', 'Consistent hashing'],
          ['cap-pacelc', 'CAP and PACELC'],
          ['consistency-models', 'Consistency models'],
          ['unique-ids', 'Unique ID generation'],
          ['object-storage', 'Object storage'],
          ['search-index', 'Search index'],
          ['time-series-db', 'Time-series databases'],
          ['data-warehouse', 'Data warehouse and OLAP'],
          ['probabilistic-structures', 'Bloom filters and HyperLogLog'],
        ],
      },
      {
        id: 'communication',
        title: 'Communication',
        entries: [
          ['api-styles', 'API styles: REST, RPC, gRPC, GraphQL'],
          ['api-design', 'API design: pagination, versioning, idempotency'],
          ['realtime-delivery', 'Real-time: polling, SSE, WebSocket'],
          ['message-queues', 'Message queues and streams'],
          ['pubsub', 'Pub/sub and event-driven design'],
          ['background-jobs', 'Background jobs and schedulers'],
          ['back-pressure', 'Back pressure and load shedding'],
          ['stream-processing', 'Stream processing'],
        ],
      },
      {
        id: 'reliability',
        title: 'Reliability and coordination',
        entries: [
          ['failover', 'Failover: active-passive, active-active'],
          ['timeouts-retries', 'Timeouts, retries, backoff and jitter'],
          ['circuit-breakers', 'Circuit breakers and bulkheads'],
          ['failure-detection', 'Failure detection: heartbeats and gossip'],
          ['clocks-ordering', 'Clocks, ordering and version vectors'],
          ['consensus', 'Consensus and leader election (Raft)'],
          ['distributed-locks', 'Distributed locks and fencing tokens'],
          ['distributed-transactions', 'Distributed transactions: 2PC, sagas, outbox'],
        ],
      },
      {
        id: 'architecture',
        title: 'Architecture',
        entries: [
          ['monolith-microservices', 'Monolith, modular monolith, microservices'],
          ['architectural-styles', 'Architectural styles'],
          ['domain-driven-design', 'Domain-driven design and service boundaries'],
          ['event-sourcing-cqrs', 'Event sourcing and CQRS'],
          ['service-mesh', 'Service mesh and sidecars'],
          ['containers-serverless', 'Containers and serverless'],
          ['migration-patterns', 'Migration: strangler fig, anti-corruption layer'],
        ],
      },
      {
        id: 'security',
        title: 'Security',
        entries: [
          ['authentication', 'Authentication and authorization'],
          ['encryption', 'Encryption, PKI and secrets'],
          ['web-security', 'Web security: OWASP, DDoS, firewalls'],
        ],
      },
      {
        id: 'operations',
        title: 'Operations',
        entries: [
          ['observability', 'Observability: logs, metrics, traces'],
          ['deployments', 'Deployments: CI/CD, blue-green, canary'],
          ['feature-flags', 'Feature flags and config'],
          ['performance-antipatterns', 'Performance antipatterns clinic'],
        ],
      },
      {
        id: 'systems-basic',
        title: 'Whole systems: basic',
        entries: [
          ['design-url-shortener', 'Design a URL shortener'],
          ['design-pastebin', 'Design Pastebin'],
          ['design-rate-limiter', 'Design a distributed rate limiter'],
          ['design-search-autocomplete', 'Design search autocomplete'],
          ['design-notification-system', 'Design a notification system'],
          ['design-key-value-store', 'Design a key-value store'],
          ['design-leaderboard', 'Design a gaming leaderboard'],
        ],
      },
      {
        id: 'systems-intermediate',
        title: 'Whole systems: intermediate',
        entries: [
          ['design-news-feed', 'Design a news feed'],
          ['design-instagram', 'Design Instagram'],
          ['design-chat', 'Design a chat system'],
          ['design-youtube', 'Design YouTube'],
          ['design-google-drive', 'Design Google Drive'],
          ['design-web-crawler', 'Design a web crawler'],
          ['design-proximity-service', 'Design a proximity service'],
          ['design-nearby-friends', 'Design nearby friends'],
          ['design-hotel-reservation', 'Design a hotel reservation system'],
          ['design-email-service', 'Design an email service'],
        ],
      },
      {
        id: 'systems-advanced',
        title: 'Whole systems: advanced',
        entries: [
          ['design-uber', 'Design Uber ride matching'],
          ['design-netflix', 'Design Netflix streaming'],
          ['design-google-maps', 'Design Google Maps'],
          ['design-distributed-cache', 'Design a distributed cache'],
          ['design-message-queue', 'Design a distributed message queue'],
          ['design-metrics-monitoring', 'Design metrics monitoring and alerting'],
          ['design-ad-click-aggregator', 'Design an ad click aggregator'],
          ['design-object-storage', 'Design S3-style object storage'],
          ['design-search-engine', 'Design a search engine'],
          ['design-distributed-file-system', 'Design a distributed file system'],
          ['design-payment-system', 'Design a payment system'],
          ['design-digital-wallet', 'Design a digital wallet'],
          ['design-stock-exchange', 'Design a stock exchange'],
        ],
      },
      {
        id: 'systems-modern',
        title: 'Whole systems: modern products',
        entries: [
          ['design-slack', 'Design Slack'],
          ['design-notion', 'Design Notion'],
          ['design-figma', 'Design Figma'],
          ['design-video-conferencing', 'Design Meet or Zoom'],
          ['design-twitch', 'Design Twitch'],
          ['design-tiktok', 'Design TikTok'],
          ['design-tinder', 'Design Tinder'],
          ['design-crypto-exchange', 'Design a crypto exchange'],
          ['design-iot-platform', 'Design an IoT platform'],
        ],
      },
      {
        id: 'war-room',
        title: 'War room and real architectures',
        entries: [
          ['war-hot-partition', 'Hot partition'],
          ['war-dns-ttl-outage', 'DNS TTL outage'],
          ['war-retry-storm', 'Retry storm'],
          ['war-cascading-failure', 'Cascading microservice failure'],
          ['war-black-friday', 'Black Friday checkout meltdown'],
          ['real-architectures', 'Real architecture case studies'],
        ],
      },
    ],
  },
  {
    id: 'lld',
    title: 'Low level design track',
    subtitle: 'Object design, from clean code and SOLID to patterns, classic problems and concurrency.',
    chapters: [
      {
        id: 'lld-foundations',
        title: 'Design foundations',
        entries: [
          ['lld-clean-code', 'Clean code basics'],
          ['lld-oop', 'Four pillars of OOP'],
          ['lld-cohesion-coupling', 'Cohesion vs coupling'],
          ['lld-solid', 'SOLID principles'],
          ['lld-design-principles', 'DRY, YAGNI, composition over inheritance'],
          ['lld-uml', 'UML class and sequence diagrams'],
        ],
      },
      {
        id: 'lld-patterns',
        title: 'Design patterns',
        entries: [
          ['lld-creational-patterns', 'Creational patterns'],
          ['lld-structural-patterns', 'Structural patterns'],
          ['lld-behavioral-patterns', 'Behavioral patterns'],
          ['lld-enterprise-patterns', 'Enterprise patterns: repository, DTO, value object'],
        ],
      },
      {
        id: 'lld-problems',
        title: 'Classic problems',
        entries: [
          ['lld-parking-lot', 'Parking lot'],
          ['lld-vending-machine', 'Vending machine'],
          ['lld-logger', 'Logger'],
          ['lld-tic-tac-toe', 'Tic-tac-toe'],
          ['lld-lru-cache', 'LRU cache'],
          ['lld-rate-limiter', 'Rate limiter'],
          ['lld-elevator', 'Elevator system'],
          ['lld-splitwise', 'Splitwise'],
          ['lld-library', 'Library management'],
        ],
      },
      {
        id: 'lld-concurrency',
        title: 'Concurrency',
        entries: [
          ['lld-locks-races', 'Locks and races'],
          ['lld-deadlock', 'Deadlock'],
          ['lld-producer-consumer', 'Producer-consumer'],
        ],
      },
      {
        id: 'lld-advanced',
        title: 'Advanced problems',
        entries: [
          ['lld-chess', 'Chess'],
          ['lld-snake-ladder', 'Snake and ladder'],
          ['lld-file-system', 'In-memory file system'],
          ['lld-stack-overflow', 'Stack Overflow'],
          ['lld-hotel-booking', 'Hotel booking'],
        ],
      },
    ],
  },
  {
    id: 'ai',
    title: 'AI systems track',
    subtitle: 'RAG pipelines, LLM serving and agent architectures in production.',
    chapters: [
      {
        id: 'ai-foundations',
        title: 'AI foundations',
        entries: [
          ['ai-tokens-context', 'Tokens and context windows'],
          ['ai-embeddings', 'Embeddings and similarity'],
          ['ai-vector-databases', 'Vector databases and ANN indexes'],
        ],
      },
      {
        id: 'ai-rag',
        title: 'RAG systems',
        entries: [
          ['ai-naive-rag', 'Naive RAG'],
          ['ai-hybrid-search', 'Hybrid search'],
          ['ai-reranking', 'Reranking'],
        ],
      },
      {
        id: 'ai-serving',
        title: 'LLM serving',
        entries: [
          ['ai-kv-cache', 'Prefill, decode and the KV cache'],
          ['ai-continuous-batching', 'Continuous batching'],
          ['ai-paged-attention', 'PagedAttention'],
          ['ai-speculative-decoding', 'Speculative decoding'],
        ],
      },
      {
        id: 'ai-agents',
        title: 'Agents and production',
        entries: [
          ['ai-react-loop', 'ReAct loop'],
          ['ai-tool-calling', 'Tool calling and MCP'],
          ['ai-durable-execution', 'Durable execution'],
          ['ai-hybrid-legacy', 'Hybrid and legacy integration'],
          ['ai-war-room', 'AI war room'],
          ['ai-real-architectures', 'AI real architectures'],
        ],
      },
    ],
  },
];

// The index of every lesson (generated from the lesson files by vite.config.ts), and a loader per
// lesson file so each lesson's full content downloads only when it is opened.
const loaders = import.meta.glob<Record<string, unknown>>(['./*.ts', '!./index.ts']);
const byId = new Map<string, LessonMeta>(manifest.map((m) => [m.id, m]));
const fileById = new Map<string, string>(manifest.map((m) => [m.id, m.file]));

export const BOOKS: Book[] = PATH.map((book) => ({
  id: book.id,
  title: book.title,
  subtitle: book.subtitle,
  chapters: book.chapters.map((ch, i) => ({
    id: ch.id,
    number: String(book.id === 'core' ? i : i + 1).padStart(2, '0'),
    title: ch.title,
    // A lesson too long for one sitting is split into `<id>` and `<id>-part-2`; part 2 follows part 1.
    lessons: ch.entries.flatMap(([id]) => [byId.get(id), byId.get(`${id}-part-2`)].filter((l): l is LessonMeta => !!l)),
    planned: ch.entries.filter(([id]) => !byId.has(id)).map(([, title]) => title),
  })),
}));

export interface LessonRef {
  lesson: LessonMeta;
  chapter: Chapter;
}

let cache: LessonRef[] | null = null;

/** Every published lesson in course order. */
export function allLessons(): LessonRef[] {
  if (!cache) cache = BOOKS.flatMap((b) => b.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => ({ lesson, chapter }))));
  return cache;
}

export function findLesson(id: string): LessonRef | undefined {
  return allLessons().find((l) => l.lesson.id === id);
}

const loaded = new Map<string, Promise<Lesson>>();

/** Fetch a lesson's full content. Repeat calls share one request. */
export function loadLesson(id: string): Promise<Lesson> {
  let p = loaded.get(id);
  if (!p) {
    const file = fileById.get(id);
    const load = file ? loaders['./' + file] : undefined;
    p = load
      ? load().then((mod) => {
          const lesson = Object.values(mod).find((v) => v && typeof v === 'object' && Array.isArray((v as Lesson).steps)) as Lesson | undefined;
          if (!lesson) throw new Error(`Lesson file for ${id} exports no lesson`);
          return lesson;
        })
      : Promise.reject(new Error(`No lesson file for ${id}`));
    p.catch(() => loaded.delete(id)); // allow a retry after a failed download
    loaded.set(id, p);
  }
  return p;
}
