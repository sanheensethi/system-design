# Course roadmap: zero to advanced

## Summary

- 15 lessons are live. All 15 sit in two HLD chapters (foundations and building blocks). 49 more are listed as planned in `src/lessons/index.ts`.
- The full path below has 13 stages and 142 lessons: 15 live, 49 planned, 78 missing.
- Biggest gaps: no prerequisites stage (networking, HTTP, DNS), no communication stage beyond queues (API styles, WebSocket), no reliability stage (timeouts, retries, circuit breakers, consensus), no security or operations lessons at all.
- 6 of the owner's 20 HLD building blocks have no live or planned lesson: object storage, search index, time-series DB, data warehouse, stream processing, service mesh. Consensus, distributed locks, circuit breakers and feature flags are also unplanned.
- Several planned whole-system designs depend on missing lessons. WhatsApp needs WebSocket. YouTube, Instagram and Dropbox need object storage. The Dynamo-style store needs clocks, gossip and quorums.
- Sources read: the supplied book (all 16 chapters, text extracted and skimmed at section level), the three roadmap.sh roadmaps (topic node lists from the public repo, which now redirects to `nilbuild/developer-roadmap`), and the owner's HLD chapters 1 and 2 in `docs/source/`.
- Sources not read: the owner's other chapters. Only chapter titles were available for LLD, AI and HLD chapters 3 onward. Rows that rest on a title alone say so.
- The roadmap.sh node descriptions were not read, only node names. Coverage marks for those sources mean "a node with this name exists".

Source keys used in the tables:

- **Book**: System Design Interview, An Insider's Guide (chapter number in brackets)
- **SD**: roadmap.sh system-design
- **SA**: roadmap.sh software-architect
- **SDA**: roadmap.sh software-design-architecture
- **Owner**: the owner's books (HLD, LLD, AI)

## The path

### Stage 0: prerequisites

| Lesson | Status | Why it sits here | Sources |
|---|---|---|---|
| What system design is and how to read a diagram | missing | Gives a beginner the vocabulary (client, server, database) used from lesson one | SD, SA |
| Networking basics: IP, ports, TCP and UDP | missing | Every later lesson counts round trips over TCP | SD, SA |
| HTTP, HTTPS and TLS | missing | Methods, status codes and headers appear in the gateway, CDN and rate limiting lessons | SD, SA, Book (1) |
| DNS in depth | missing | Records, TTLs and geo routing are assumed by the CDN and multi-region lessons | SD, Book (1) |

### Stage 1: foundations

| Lesson | Status | Why it sits here | Sources |
|---|---|---|---|
| How a request travels | live | First end-to-end picture of one request | Book (1), Owner HLD 1 |
| Latency numbers every engineer should know | live | Gives costs to each hop in the picture | Book (2), Owner HLD 1 |
| Latency, throughput and percentiles | missing | p50 and p99 are used in lesson metrics but never taught | SD, Owner HLD 1 |
| Napkin math: capacity estimation | live | Turns users into QPS, storage and servers | Book (2), Owner HLD 1 |
| Availability in numbers: nines, SLA, SLO | missing | Targets must exist before redundancy is discussed | Book (2), SD, Owner HLD 1 |
| Scaling up, scaling out, and the five levers | live | Map of every tool in stages 2 to 5 | Book (1), SD, Owner HLD 1 |
| A framework for any design: the five-question funnel | missing | Scale, read:write ratio, consistency, latency, availability decide the design | Book (3), SD, Owner HLD 1 |

### Stage 2: scaling and traffic

| Lesson | Status | Why it sits here | Sources |
|---|---|---|---|
| Load balancing | live | First tool for scaling out stateless servers | Book (1), SD, Owner HLD 2 |
| Reverse proxies and API gateways | live | Builds on the load balancer as a smarter front door | SD, SA, Owner HLD 2 |
| Caching | live | First lever for read load | Book (1), SD, Owner HLD 2 |
| Content delivery networks | live | Caching moved to the edge | Book (1), SD, Owner HLD 2 |
| Rate limiting | live | Protects everything above. Needs the cache lesson for the shared Redis counter | Book (4), SD, Owner HLD 2 |
| Service discovery and health checks | missing | Explains how the balancer and gateway find live servers | Book (12), SD |
| Multi-region and geo routing | missing | The "localize" lever has no lesson of its own | Book (1), SD, Owner HLD 1 |

### Stage 3: data

| Lesson | Status | Why it sits here | Sources |
|---|---|---|---|
| SQL and the NoSQL families | live | Entry point to all storage choices | Book (1), SD, SA, Owner HLD 2 |
| Indexes and query tuning | missing | The cheapest database fix, needed before scaling the database | SD, Owner HLD 2 |
| Transactions and isolation levels | missing | ACID is introduced in the SQL lesson, isolation is not | SA, Owner HLD 2 |
| Storage engines: B-tree, LSM tree, WAL | missing | Explains why wide-column stores take writes fast | Book (6), Owner HLD 1 |
| Data modeling: normalize, denormalize, materialized views | missing | Read-heavy designs (feeds) depend on storing data in read shape | SD, Owner HLD 1 |
| Replication | live | Read scale and failover | Book (1, 6), SD, Owner HLD 1 |
| Sharding | live | Write scale. Ends on the resharding problem | Book (1), SD, Owner HLD 1 |
| Consistent hashing | live | Solves the resharding problem from the previous lesson | Book (5) |
| CAP and PACELC | live | Names the trade made by replication | Book (6), SD, SA, Owner HLD 1 |
| Consistency models: linearizable to eventual | missing | The ladder between "strong" and "eventual" that CAP skips | Book (6), SD, Owner HLD 1 |
| Unique ID generation (Snowflake) | missing | Sharded tables cannot use auto-increment | Book (7) |
| Object storage | missing | Needed by every media design | Book (14, 15), SD, Owner HLD 2 |
| Search index | missing | Inverted index, needed by search and autocomplete designs | Owner HLD 2 |
| Time-series databases | missing | Store for metrics and IoT | Owner HLD 2 |
| Data warehouse and OLAP | missing | Row store vs column store, ETL and CDC | SA, Owner HLD 2 |
| Probabilistic structures: bloom filter, HyperLogLog | missing | Used by the crawler, the KV store and the ad counter | Book (6, 9) |

### Stage 4: communication

| Lesson | Status | Why it sits here | Sources |
|---|---|---|---|
| API styles: REST, RPC, gRPC, GraphQL | missing | Every whole-system design starts with an API | SD, SA, Book (8, 11) |
| API design: pagination, versioning, idempotency keys | missing | Makes retries safe before the reliability stage | SD, Book (11) |
| Real-time delivery: polling, long polling, SSE, WebSocket | missing | Required by chat, notifications and file sync | Book (12, 15) |
| Message queues and streams | live | Async work and decoupling | Book (1), SD, SA, SDA, Owner HLD 2 |
| Pub/sub and event-driven design | missing | One event, many subscribers. Fan-out for feeds | SD, SDA |
| Background jobs and schedulers | missing | Cron, DAG pipelines, long-running work | SD, Book (14) |
| Back pressure and load shedding | missing | What to do when the queue only grows | SD |
| Stream processing: windows and watermarks | missing | Needed by the ad click aggregator | SA, Owner HLD 2 |

### Stage 5: reliability and coordination

| Lesson | Status | Why it sits here | Sources |
|---|---|---|---|
| Failover patterns: active-passive and active-active | missing | Generalizes the failover seen in load balancing and replication | SD, Book (1) |
| Timeouts, retries, backoff and jitter | missing | Prerequisite for the retry storm war room | SD |
| Circuit breakers and bulkheads | missing | Prerequisite for the cascading failure war room | SD, Owner HLD 2 |
| Failure detection: heartbeats and gossip | missing | How a cluster learns a node died | Book (6, 12) |
| Clocks, ordering and version vectors | missing | Why timestamps lie, and how conflicts are detected | Book (6, 7) |
| Consensus and leader election (Raft) | missing | The "majority vote" that replication and CAP lessons assume | SD, Owner HLD 2 |
| Distributed locks and fencing tokens | missing | First practical use of consensus | Owner HLD 2 |
| Distributed transactions: 2PC, sagas, outbox | missing | Cross-shard and cross-service writes | SD, SA |

### Stage 6: architecture

| Lesson | Status | Why it sits here | Sources |
|---|---|---|---|
| Monolith, modular monolith, microservices | missing | The first structural decision. Needs stages 4 and 5 to show the cost | SD, SA, SDA, Book (1) |
| Architectural styles: layered, client-server, event-driven, peer-to-peer | missing | Vocabulary for describing any system | SA, SDA |
| Domain-driven design and service boundaries | missing | How to decide where to cut services | SA, SDA |
| Event sourcing and CQRS | missing | Builds on logs from the queue lesson | SD, SA, SDA |
| Service mesh and sidecars | missing | Moves retries, mTLS and tracing out of service code | SD, SA, Owner HLD 2 |
| Containers and serverless | missing | How the services run | SA, SDA |
| Migration patterns: strangler fig, anti-corruption layer | missing | How to change architecture without a rewrite | SD |

### Stage 7: security

| Lesson | Status | Why it sits here | Sources |
|---|---|---|---|
| Authentication and authorization: sessions, JWT, OAuth, SSO | missing | The gateway lesson checks a token without explaining tokens | SD, SA |
| Encryption in transit and at rest, PKI, secrets | missing | Chat, video and file designs all ask for encryption | SA, Book (12, 14, 15) |
| Web security: OWASP risks, DDoS, firewalls | missing | Edge protection beyond rate limiting | SD, SA |

### Stage 8: operations

| Lesson | Status | Why it sits here | Sources |
|---|---|---|---|
| Observability: logs, metrics, traces, alerts | missing | Needed before any war room lesson | Book (1), SD, SA |
| Deployments: CI/CD, blue-green, canary, rollback | missing | How changes reach production safely | SA, Book (1) |
| Feature flags and config service | missing | Runtime switches and kill switches | SD, Owner HLD 2 |
| Performance antipatterns clinic | missing | Chatty I/O, busy database, no caching, retry storm as one review | SD |

### Stage 9: whole-system designs, by difficulty

| Lesson | Status | Why it sits here | Sources |
|---|---|---|---|
| URL shortener | planned | Smallest full design: API, hashing, cache, database | Book (8), Owner HLD 3 |
| Pastebin | planned | URL shortener plus object storage | Owner HLD 3 |
| Distributed rate limiter | planned | Extends the live lesson to many nodes and regions | Book (4), Owner HLD 3 |
| Search autocomplete | missing | Trie plus cache, read-heavy and small | Book (13) |
| Dynamo-style key-value store | planned | Combines ring, quorum, gossip and version vectors. Hardest of the basics | Book (6), Owner HLD 3 |
| Notification system | planned | Queues, retries and third-party providers. Listed under very high scale today | Book (10), Owner HLD 6 |
| Twitter home timeline | planned | Fan-out on write vs read | Book (11), Owner HLD 4 |
| Instagram photo sharing | planned | Timeline plus media pipeline and CDN | Owner HLD 4 |
| WhatsApp chat | planned | WebSocket, presence, message sync | Book (12), Owner HLD 4 |
| YouTube | planned | Upload, transcoding DAG, streaming | Book (14), Owner HLD 4 |
| Dropbox | planned | Chunking, delta sync, conflict handling | Book (15), Owner HLD 4 |
| Uber ride matching | planned | Geo index and real-time location | Owner HLD 5 |
| Netflix streaming | planned | CDN at the ISP edge, adaptive bitrate | Owner HLD 5 |
| Google Maps | planned | Tiles, routing graph | Owner HLD 5 |
| Distributed cache at scale | planned | Cache cluster with ring and replication | Owner HLD 5 |
| Web crawler | planned | Frontier, politeness, dedup | Book (9), Owner HLD 6 |
| Ad click aggregator | planned | Stream processing and exactly-once counts | Owner HLD 6 |
| Search engine | planned | Crawl, index, rank, serve | Owner HLD 6 |
| Stock exchange order book | planned | Low latency, strict ordering | Owner HLD 6 |
| Distributed file system | planned | Chunk servers and a metadata master | Owner HLD 6 |
| Slack | missing | Chat with channels and search | Owner HLD modern problems |
| Notion | missing | Block storage and sync | Owner HLD modern problems |
| Figma | missing | Real-time multiplayer editing | Owner HLD modern problems |
| Meet or Zoom | missing | Media servers and UDP | Owner HLD modern problems |
| Twitch | missing | Live video ingest and chat | Owner HLD modern problems |
| TikTok | missing | Recommendation feed plus video | Owner HLD modern problems |
| Tinder | missing | Geo matching | Owner HLD modern problems |
| Crypto exchange | missing | Matching engine plus custody | Owner HLD modern problems |
| IoT platform | missing | Write-heavy telemetry and time-series storage | Owner HLD modern problems |

The owner's modern problems list also has feature flags. It is covered by the stage 8 lesson.

### Stage 10: war room and real architectures

| Lesson | Status | Why it sits here | Sources |
|---|---|---|---|
| Hot partition | planned | Needs sharding only, so it comes first | Owner HLD war room |
| DNS TTL outage | planned | Needs the DNS lesson | Owner HLD war room |
| Retry storm | planned | Needs timeouts and retries | SD, Owner HLD war room |
| Cascading microservice failure | planned | Needs circuit breakers and microservices | Owner HLD war room |
| Black Friday checkout meltdown | planned | Uses every stage. Good capstone | Owner HLD war room |
| Real architecture case studies (series) | missing | Shows the patterns in named production systems | Book (16), Owner HLD real architectures |

### Stage 11: LLD track

This track can run in parallel with stages 1 to 8. It has no dependency on them until the concurrency lessons.

| Lesson | Status | Why it sits here | Sources |
|---|---|---|---|
| Clean code basics: names, small functions, consistency | missing | Comes before OOP on the roadmap.sh SDA path | SDA |
| Four pillars of OOP | planned | Base vocabulary for all patterns | SA, SDA, Owner LLD |
| Cohesion vs coupling | planned | The measure that SOLID optimizes | SDA, Owner LLD |
| SOLID principles | planned | Needs OOP and coupling | SA, SDA, Owner LLD |
| Design principles: DRY, YAGNI, composition over inheritance, Law of Demeter | missing | Short rules that the patterns apply | SDA |
| UML class and sequence diagrams | missing | The notation every LLD problem is drawn in | SA |
| Creational patterns | planned | Easiest pattern family | SA, SDA, Owner LLD |
| Structural patterns | planned | Second family | SA, SDA, Owner LLD |
| Behavioral patterns | planned | Largest family, used most in the problems | SA, SDA, Owner LLD |
| Enterprise patterns: repository, DTO, mapper, value object | missing | Bridge from classes to services | SDA |
| Parking lot | planned | Standard first problem | Owner LLD |
| Vending machine | missing | State pattern in practice | Owner LLD |
| Logger | missing | Chain of responsibility, singleton | Owner LLD |
| Tic-tac-toe | missing | Small game model | Owner LLD |
| LRU cache | planned | Data structure design. Links to the caching lesson | Owner LLD |
| Rate limiter | planned | Strategy pattern. Links to the rate limiting lesson | Owner LLD |
| Elevator system | planned | State and scheduling | Owner LLD |
| Splitwise | missing | Graph of debts | Owner LLD |
| Library management | missing | Classic entity modeling | Owner LLD |
| Locks and races | planned | Start of concurrency | Owner LLD |
| Deadlock | planned | Needs locks | Owner LLD |
| Producer-consumer | planned | Needs locks. Links to message queues | Owner LLD |
| Chess | missing | Advanced polymorphism | Owner LLD |
| Snake and ladder | missing | Simple advanced-tier warm-up | Owner LLD |
| In-memory file system | missing | Composite pattern | Owner LLD |
| Stack Overflow | missing | Large entity model | Owner LLD |
| Hotel booking | missing | Concurrency on inventory | Owner LLD |

### Stage 12: AI systems track

None of the roadmap.sh roadmaps or the supplied book cover this track. The owner's AI book is the only source, and only its chapter titles were available.

| Lesson | Status | Why it sits here | Sources |
|---|---|---|---|
| Tokens and context windows | planned | Unit of cost and limits | Owner AI |
| Embeddings and similarity | planned | Base for retrieval | Owner AI |
| Vector databases and ANN indexes | missing | Sits between embeddings and RAG. Placement is an inference from the "Building blocks" chapter title | Owner AI (title only) |
| Naive RAG | planned | First full pipeline | Owner AI |
| Hybrid search | planned | Needs the search index lesson (stage 3) | Owner AI |
| Reranking | planned | Last retrieval step | Owner AI |
| Prefill, decode and the KV cache | planned | Base for all serving lessons. Fits better under LLM serving than under foundations | Owner AI |
| Continuous batching | planned | Throughput on one GPU | Owner AI |
| PagedAttention | planned | Needs the KV cache lesson | Owner AI |
| Speculative decoding | planned | Latency trick, last in serving | Owner AI |
| ReAct loop | planned | Basic agent | Owner AI |
| Tool calling and MCP | planned | How agents act | Owner AI |
| Durable execution | planned | Needs retries and idempotency (stages 4 and 5) | Owner AI |
| Hybrid and legacy integration | missing | Chapter exists in the owner's book, no lesson planned | Owner AI (title only) |
| AI war room | missing | Same | Owner AI (title only) |
| AI real architectures | missing | Same | Owner AI (title only) |

## Missing topics

Topics in the sources with no live or planned lesson.

### Prerequisites and foundations

| Topic | Priority | Reason |
|---|---|---|
| Networking basics (TCP, UDP, IP) | must | A zero-level learner cannot follow "round trip" or "handshake" without it |
| HTTP, HTTPS, TLS | must | Used in 6 live lessons, taught in none |
| DNS in depth | should | The request lesson covers lookup and TTL only |
| Percentiles and tail latency | must | Lessons show p99 chips with no definition |
| Availability nines, SLA, SLO | must | In the book, roadmap.sh SD and the owner's chapter 1 |
| Design framework and requirements | must | Book chapter 3 and the owner's five-question funnel. Every stage 9 lesson needs it |
| What system design is | nice | Short orientation lesson |

### Traffic

| Topic | Priority | Reason |
|---|---|---|
| Service discovery | should | The chat design in the book depends on it |
| Multi-region, geo routing, data center failover | should | Book chapter 1 treats it as a core scaling step |
| Multi-tenancy: noisy neighbor, deployment stamps | nice | roadmap.sh SD only. Not placed on the path |

### Data

| Topic | Priority | Reason |
|---|---|---|
| Object storage | must | Owner building block. Blocks 4 planned designs |
| Indexes and query tuning | must | Most common real fix, only one case step today |
| Consistency models | must | In all of book, SD and owner chapter 1 |
| Unique ID generation | must | A full book chapter, needed by every sharded design |
| Search index | must | Owner building block. Blocks search engine and autocomplete |
| Transactions and isolation levels | should | Needed for booking, payment and exchange designs |
| Storage engines (B-tree, LSM) | should | Explains the write path in the book's KV store chapter |
| Data modeling and denormalization | should | Feeds and timelines rest on it |
| Time-series database | should | Owner building block. Needed for IoT and metrics |
| Data warehouse, OLAP, ETL | should | Owner building block and roadmap.sh SA |
| Bloom filter and friends | should | Book uses it in two chapters |
| Batch processing (Hadoop, Spark, MapReduce) | nice | roadmap.sh SA only. Not placed on the path |

### Communication

| Topic | Priority | Reason |
|---|---|---|
| REST, RPC, gRPC, GraphQL | must | Four nodes on roadmap.sh SD, zero lessons |
| WebSocket, long polling, SSE | must | Blocks WhatsApp, notifications, Dropbox |
| API design and idempotency | must | Retries are unsafe without it |
| Pub/sub and event-driven design | should | The queue lesson covers work queues and logs. Fan-out design gets a few lines |
| Stream processing | should | Owner building block. Blocks the ad click aggregator |
| Background jobs and schedulers | should | Book's video pipeline is a job DAG |
| Back pressure and load shedding | should | Named pattern on roadmap.sh SD |
| Claim check, sequential convoy, pipes and filters | nice | roadmap.sh SD cloud patterns. Not placed on the path |

### Reliability and coordination

| Topic | Priority | Reason |
|---|---|---|
| Timeouts, retries, backoff | must | Two planned war rooms depend on it |
| Circuit breaker and bulkhead | must | Owner building block and roadmap.sh SD |
| Consensus and leader election | must | Owner building block. Replication and CAP lessons assume a majority vote |
| Distributed transactions, sagas, outbox | must | No lesson explains a write that spans services |
| Clocks and version vectors | should | Core of the book's KV store chapter |
| Heartbeats and gossip | should | Same chapter |
| Distributed locks and fencing | should | Owner building block |
| Failover patterns | should | Scattered across two live lessons, never generalized |

### Architecture

| Topic | Priority | Reason |
|---|---|---|
| Monolith vs microservices | must | On all three roadmap.sh roadmaps |
| Event sourcing and CQRS | should | On all three roadmap.sh roadmaps |
| Service mesh and sidecar | should | Owner building block |
| Architectural styles | should | Large part of roadmap.sh SDA |
| Domain-driven design | should | roadmap.sh SA and SDA |
| Containers and serverless | should | roadmap.sh SA and SDA |
| Strangler fig, anti-corruption layer | nice | roadmap.sh SD |
| Micro frontends, SPA vs SSR vs SSG | nice | roadmap.sh SA. Front-end scope, not placed on the path |
| Enterprise frameworks (TOGAF, ITIL, BPM, ESB, SAP) | nice | roadmap.sh SA. Process topics that do not suit animation. Not placed on the path |

### Security and operations

| Topic | Priority | Reason |
|---|---|---|
| Authentication and authorization | must | No lesson explains a session, a JWT or OAuth |
| Observability | must | Book chapter 1 and 8 monitoring nodes on roadmap.sh SD |
| Encryption, PKI, secrets | should | Asked for in three book designs |
| OWASP, DDoS, firewalls | should | roadmap.sh SA |
| CI/CD and deployment strategies | should | roadmap.sh SA |
| Feature flags and config | should | Owner building block |
| Performance antipatterns | nice | 10 nodes on roadmap.sh SD. Good review lesson |

### Whole systems

| Topic | Priority | Reason |
|---|---|---|
| Search autocomplete | should | Full book chapter, not in the planned list |
| Real architecture case studies | should | Owner chapter and the book's last chapter |
| 9 modern problems (Slack, Notion, Figma, Meet, Twitch, TikTok, Tinder, crypto exchange, IoT) | nice | Owner chapter. Build after stage 9 planned lessons |
| HLD "modern patterns" chapter | unknown | Title only. Contents not available |

### LLD track

| Topic | Priority | Reason |
|---|---|---|
| UML diagrams | must | Every LLD problem is drawn as a class diagram |
| Design principles (DRY, YAGNI, composition over inheritance, tell don't ask) | should | 10 or more nodes on roadmap.sh SDA |
| Clean code | should | First section of roadmap.sh SDA |
| Enterprise patterns (repository, DTO, mapper, value object, ORM) | should | roadmap.sh SDA |
| 10 problems: vending machine, logger, tic-tac-toe, Splitwise, library, chess, snake and ladder, file system, Stack Overflow, hotel booking | should | In the owner's LLD book, absent from the planned list |
| Programming paradigms: structured, functional | nice | roadmap.sh SDA and SA. Not placed on the path |
| TDD | nice | roadmap.sh SA. Not placed on the path |
| LLD war room, real company code, applying LLD, modern patterns, modern problems | unknown | Titles only. Contents not available |

### AI track

| Topic | Priority | Reason |
|---|---|---|
| AI building blocks chapter (vector database assumed) | should | Owner chapter with no planned lesson. Contents not read |
| Hybrid and legacy, war room, real architectures | unknown | Titles only |

## Existing lessons to deepen

| Lesson | What the sources cover that the lesson does not |
|---|---|
| How a request travels | TCP vs UDP is absent. HTTP methods and status codes get one mention. Move both to the stage 0 lessons and keep this one as is |
| Latency numbers | No percentiles or tail latency. The owner's chapter also has a data size reference and standard server capacities table that the lesson skips |
| Napkin math | Complete against the owner's six formulas. The book adds availability numbers (nines) to estimation, which belongs in the new availability lesson |
| Scaling levers | Multi data center setup and geo routing from book chapter 1 are missing. The "localize" lever gets less screen time than the other four |
| Load balancing | No TLS termination. DNS-level and global load balancing get one mention. Active-active gets one mention. Weighted routing gets one mention |
| Reverse proxies and API gateways | No service discovery (how the gateway finds instances). No circuit breaking at the gateway. roadmap.sh gateway routing, aggregation and offloading are all covered |
| Caching | The five cache layers on roadmap.sh SD (client, CDN, web server, database, application) are not laid out. No read-through or write-around. Refresh-ahead is brief. No cache penetration (misses for keys that do not exist) |
| Content delivery networks | No fallback when the CDN itself fails (book chapter 1). No dynamic content or edge compute. Push vs pull is brief |
| SQL and the NoSQL families | Isolation levels, normalization, B-tree and LSM each get one mention. No denormalization. No time-series or OLAP stores. Each of these is a separate lesson in stage 3, so add forward links only |
| Replication | Conflict detection with version vectors and hinted handoff from book chapter 6 are absent. Consensus is used (majority vote) with one mention of Raft. Fix with the stage 5 lessons |
| Sharding | No secondary indexes across shards. No ID generation for sharded tables. No functional partitioning (federation on roadmap.sh SD). No pre-split logical shards |
| Consistent hashing | Complete. Covers everything in book chapter 5, plus replicas on the ring |
| CAP and PACELC | The consistency ladder from the owner's chapter (linearizable, read-your-writes, monotonic, eventual) is absent. No version vectors for conflict detection. Last-writer-wins and merge are covered |
| Message queues and streams | No back pressure. No priority queues. No outbox pattern. Pub/sub fan-out is brief. Ordering, acks, DLQ, consumer groups and replay are covered |
| Rate limiting | Book chapter 4 also covers a rules configuration format, `X-RateLimit` response headers, hard vs soft limits, multi data center sync and monitoring of the limiter. The lesson has `429` and `Retry-After` only. No concurrency limits or load shedding |

## Ordering fixes

1. **Rate limiting is last, the gateway uses it second.** The API gateway lesson has a rate limit case step nine lessons before rate limiting is taught. Move rate limiting to directly after CDN, or add a forward link in the gateway step.
2. **Scaling levers previews tools it has not taught.** It uses a load balancer, cache, replicas and shards before their lessons. This works as a map lesson. Keep the order, and make each preview step link forward.
3. **Replication and CAP rely on consensus that is never taught.** Failover by majority vote, split brain fencing and quorums all appear with no consensus lesson anywhere in the registry. Add the stage 5 consensus lesson and link to it.
4. **p99 appears in metric chips from the first chapters.** Percentiles are never defined. Place the percentiles lesson in foundations.
5. **Notification system is filed under very high scale.** The book places it before news feed and chat. It needs only queues and retries. Move it to intermediate.
6. **Dynamo-style key-value store is filed under basic systems.** It needs quorums, gossip, version vectors and Merkle trees. Move it to the end of basic, or to intermediate, after the stage 5 lessons.
7. **WhatsApp chat has no real-time lesson before it.** Add the polling, long polling and WebSocket lesson first.
8. **Instagram, YouTube and Dropbox have no object storage lesson before them.** Add it first.
9. **Ad click aggregator and search engine come before their building blocks.** Stream processing and search index have no lesson.
10. **Retry storm and cascading failure war rooms come before retries and circuit breakers are taught.** Build the stage 5 lessons first.
11. **LLD rate limiter and LRU cache come before the concurrency chapter.** Both need a lock to be correct. Teach the single-threaded version there and revisit after locks, or move concurrency up.
12. **Hybrid search (AI) depends on keyword search.** BM25 and the inverted index belong to the search index lesson in HLD, which is missing.
13. **Book numbering and display order disagree.** The registry lists "Book II" (HLD) before "Book I" (LLD). Pick one order.

## Suggested next 15 lessons

Build order. Each one removes a blocker for a planned lesson or fills a "must" gap.

1. **HTTP, HTTPS and TLS.** A request card flips open to show method, path, headers and body. A TLS handshake adds round trips, then session reuse removes them.
2. **Latency, throughput and percentiles.** 100 request dots land on a histogram. The mean sits low while a p99 marker slides out to the slow tail.
3. **Availability in numbers.** A year-long bar loses minutes as nines are added. Two servers in series shrink the bar, two in parallel grow it.
4. **A framework for any design.** Five questions appear one at a time, and each answer adds or removes boxes from a blank diagram.
5. **API styles: REST, RPC, gRPC, GraphQL.** One screen needs three resources. REST makes three trips, GraphQL one, gRPC sends a small binary frame between services.
6. **Object storage.** A 5 MB photo jams a database row. It moves to a bucket, and the client uploads straight to it with a pre-signed URL.
7. **Indexes and query tuning.** A full table scan lights every row. A B-tree appears and the lookup walks three nodes.
8. **Unique ID generation.** Two shards hand out the same auto-increment ID and collide. A Snowflake ID assembles from timestamp, machine and sequence bits.
9. **Real-time delivery.** The same chat message arrives by polling, long polling and WebSocket, with wasted requests counted on a chip.
10. **Timeouts, retries, backoff and jitter.** A slow service gets hammered by synchronized retries. Backoff with jitter spreads the dots out and the service recovers.
11. **Circuit breakers and bulkheads.** A breaker switch moves between closed, open and half-open as errors climb. A second thread pool keeps the other endpoints alive.
12. **Consistency models.** Two users read from different replicas. The ladder steps from eventual to linearizable, and each step removes one anomaly from the screen.
13. **Consensus and leader election.** Five Raft nodes. The leader dies, timers run down, votes fly, a new leader commits a log entry on a majority.
14. **Authentication and authorization.** A login issues a session, then a JWT. The gateway checks the signature without a database call. An expired token bounces.
15. **Observability.** One slow request leaves a trace across four services. A metric spikes, a log line explains it, an alert fires.

After these 15, the first five whole-system lessons (URL shortener, Pastebin, distributed rate limiter, search autocomplete, notification system) have every prerequisite in place.
