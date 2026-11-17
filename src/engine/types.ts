/**
 * Lesson data model.
 *
 * Every lesson is plain data. The player renders any lesson that follows these
 * types, so adding a lesson never needs new animation code. A step describes the
 * whole scene as it should look at that moment; the renderer animates the
 * difference between consecutive steps (nodes are matched by `id`).
 */

/** Visual kind of a node in the isometric scene. Each kind has its own shape, color and glyph. */
export type NodeKind =
  | 'user' // a person
  | 'client' // laptop / browser
  | 'phone' // mobile client
  | 'dns' // DNS resolver
  | 'internet' // the public internet / a globe
  | 'lb' // load balancer
  | 'gateway' // API gateway / reverse proxy
  | 'server' // generic app server
  | 'service' // a microservice
  | 'worker' // background worker / consumer
  | 'db' // primary database
  | 'replica' // read replica
  | 'shard' // a database shard
  | 'cache' // in-memory cache (Redis, Memcached)
  | 'cdn' // CDN edge / point of presence
  | 'queue' // message queue / log
  | 'storage' // object storage (S3)
  | 'limiter' // rate limiter / guard
  | 'monitor' // metrics / observability
  | 'search' // search index
  | 'ring' // hash ring marker (consistent hashing)
  | 'vault' // key management service, secrets manager, certificate authority
  | 'warehouse' // data warehouse or analytics store
  | 'container' // a container or pod
  | 'block'; // a large rounded cube with an icon and a label drawn on it: an API, a service, GraphQL

export type Tint = 'blue' | 'green' | 'amber' | 'violet' | 'red' | 'gray' | 'teal';
export type Tone = 'default' | 'good' | 'warn' | 'bad';

export interface Chip {
  text: string;
  tone?: Tone;
  /** Lucide icon name. */
  icon?: string;
}

export type NodeStatus = 'idle' | 'active' | 'hot' | 'down' | 'dim' | 'ok';

export interface SceneNode {
  id: string;
  kind: NodeKind;
  /** Isometric grid position [x, y]. Keep within roughly -7..7. +x goes down-right, +y goes down-left. */
  at: [number, number];
  label?: string;
  /** Small second line under the label, e.g. an IP address or "8 GB". */
  sub?: string;
  status?: NodeStatus;
  /** Floating chip above the node, e.g. "cache hit" or "42 ms". */
  badge?: string;
  /** Scale multiplier, default 1. */
  size?: number;
  /** Face colors for a block, or the accent color for any other kind. */
  tint?: Tint;
  /** Lucide icon drawn on a block. Other kinds draw their own glyph. */
  icon?: string;
  /** A stack of up to 4 pills above the node, e.g. the requests it is handling. A badge goes on top. */
  chips?: (string | Chip)[];
  /** CPU load 0 to 100 as a small pill with a bar. Green under 60, amber under 85, red above. */
  load?: number;
}

export type LinkStyle = 'solid' | 'dashed' | 'faint';

export interface SceneLink {
  from: string;
  to: string;
  style?: LinkStyle;
  label?: string;
  /** Elbow along the two grid axes (default) or a straight line. */
  route?: 'elbow' | 'straight';
  /** Arrowheads. Default 'end'. */
  arrow?: 'none' | 'end' | 'both';
  labelTone?: Tone;
}

/** Color semantics for moving packets. Shown in the legend. */
export type FlowTone = 'request' | 'response' | 'handshake' | 'error' | 'data' | 'event';

export interface SceneFlow {
  /** Node ids the packet travels through, in order. At least two. */
  path: string[];
  tone?: FlowTone;
  /** Packets in one burst. Default 1. */
  count?: number;
  /** Seconds for one full traversal. Default 1.6. */
  duration?: number;
  /** Seconds to wait before the first packet. Default 0. */
  delay?: number;
  /** Loop forever. Default true. */
  repeat?: boolean;
  /** Text carried by the packet, e.g. "GET /", shown next to it. */
  label?: string;
}

/** A labelled floor region, e.g. a datacenter region or a shard boundary. */
export interface SceneZone {
  id: string;
  from: [number, number];
  to: [number, number];
  label: string;
  tone?: 'blue' | 'green' | 'amber' | 'violet' | 'red' | 'gray';
}

export type PanelTone = 'default' | 'good' | 'warn' | 'bad' | 'muted';

/** The one table or snippet that explains a step, drawn as a card inside the stage. */
export interface ScenePanel {
  title: string;
  icon?: string;
  /** Up to 6 rows: text on the left, an optional value on the right. */
  rows?: { text: string; value?: string; tone?: PanelTone }[];
  /** Monospace block, up to 8 lines. Shown instead of rows. */
  code?: string;
  footer?: { text: string; tone?: 'good' | 'warn' | 'bad' | 'muted' };
}

export interface Scene {
  nodes: SceneNode[];
  links?: SceneLink[];
  flows?: SceneFlow[];
  zones?: SceneZone[];
  /** One-line caption shown over the stage. */
  caption?: string;
  panel?: ScenePanel;
}

export type CodeLanguage = 'python' | 'typescript' | 'javascript' | 'go' | 'sql' | 'bash' | 'json' | 'yaml';

export interface CodeSample {
  language: CodeLanguage;
  title?: string;
  source: string;
  /** 1-based line numbers to highlight. */
  highlight?: number[];
}

export interface Quiz {
  question: string;
  options: string[];
  /** Index into options. */
  answer: number;
  /** Shown after answering, right or wrong. */
  explain: string;
}

export type StepTag = 'problem' | 'concept' | 'case' | 'tradeoff' | 'recap' | 'try';

export interface Step {
  /** Short title for the step list, 1 to 3 words. */
  title: string;
  tag: StepTag;
  heading: string;
  /**
   * The same idea for a five-year-old: one or two sentences using an everyday scene (a restaurant,
   * a post office, a school) that maps onto the objects in the diagram. Shown before the body.
   */
  eli5?: string;
  /** Paragraphs. Supports **bold** and `inline code`. */
  body: string[];
  keyIdea?: string;
  scene: Scene;
  /** Values for the lesson's metric chips, keyed by metric key. Missing keys show a dash. */
  metrics?: Record<string, string>;
  /** Colors a metric chip: a colored left edge and tinted value. */
  metricTones?: Record<string, 'good' | 'warn' | 'bad'>;
  code?: CodeSample;
  quiz?: Quiz;
}

export interface MetricDef {
  key: string;
  label: string;
  /** Lucide icon name shown before the label. */
  icon?: string;
}

export type Level = 'Beginner' | 'Intermediate' | 'Advanced';

export interface Lesson {
  id: string;
  title: string;
  tagline: string;
  minutes: number;
  level: Level;
  /** "You'll learn" bullet points. */
  learn: string[];
  metrics?: MetricDef[];
  steps: Step[];
}

/** What the course map and search need about a lesson, without its full step content. */
export interface LessonMeta {
  id: string;
  title: string;
  tagline: string;
  minutes: number;
  level: Level;
  learn: string[];
  stepCount: number;
  steps: { title: string; heading: string; keyIdea: string }[];
}

export interface Chapter {
  id: string;
  number: string;
  title: string;
  lessons: LessonMeta[];
  /** Topics planned but not built yet. Shown greyed out on the map. */
  planned?: string[];
}

export interface Book {
  id: string;
  title: string;
  subtitle: string;
  chapters: Chapter[];
}
