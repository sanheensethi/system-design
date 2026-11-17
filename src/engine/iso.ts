import type { Chip, NodeKind, Scene, SceneNode, Tone } from './types';

/** Size of one grid tile in SVG units. */
export const TILE = 64;
const COS30 = Math.cos(Math.PI / 6);
const C30 = COS30;
const SIN30 = 0.5;

/** Project an isometric grid point onto the SVG plane. */
export function project(x: number, y: number): [number, number] {
  return [(x - y) * COS30 * TILE, (x + y) * SIN30 * TILE];
}

export interface KindStyle {
  /** Total height of the drawing above the floor, in SVG units. Packets and badges anchor here. */
  height: number;
  /** Half-width of the object's footprint in tiles (the pedestal is a little larger). */
  half: number;
  /** Visual top of the drawing when it rises above `height` (a block's roof). Defaults to height. */
  reach?: number;
  /** Lucide icon name used in the label, resolved in components/icons.tsx. */
  icon: string;
  /** The one accent color this kind of object carries. Everything else is neutral ink and paper. */
  accent: string;
}

const BLUE = '#3E7BFA';
const TEAL = '#12A594';
const AMBER = '#F5A524';
const RED = '#E5484D';
const VIOLET = '#7C5CFC';
const ORANGE = '#F2762E';
const GREEN = '#46A758';

export const KIND_STYLES: Record<NodeKind, KindStyle> = {
  user: { height: 52, half: 0.3, icon: 'User', accent: BLUE },
  client: { height: 62, half: 0.5, icon: 'Laptop', accent: VIOLET },
  phone: { height: 16, half: 0.36, icon: 'Smartphone', accent: VIOLET },
  dns: { height: 44, half: 0.38, icon: 'Hash', accent: VIOLET },
  internet: { height: 66, half: 0.44, icon: 'Globe', accent: BLUE },
  lb: { height: 24, half: 0.5, icon: 'Split', accent: TEAL },
  gateway: { height: 46, half: 0.48, icon: 'Router', accent: VIOLET },
  server: { height: 72, half: 0.4, icon: 'Server', accent: BLUE },
  service: { height: 46, half: 0.38, icon: 'Boxes', accent: BLUE },
  worker: { height: 42, half: 0.38, icon: 'Cpu', accent: GREEN },
  db: { height: 60, half: 0.42, icon: 'Database', accent: AMBER },
  replica: { height: 50, half: 0.38, icon: 'Copy', accent: AMBER },
  shard: { height: 44, half: 0.4, icon: 'Layers', accent: ORANGE },
  cache: { height: 22, half: 0.42, icon: 'Zap', accent: RED },
  cdn: { height: 52, half: 0.4, icon: 'Earth', accent: TEAL },
  queue: { height: 32, half: 0.5, icon: 'Inbox', accent: VIOLET },
  storage: { height: 42, half: 0.42, icon: 'Package', accent: AMBER },
  limiter: { height: 44, half: 0.34, icon: 'Gauge', accent: ORANGE },
  monitor: { height: 54, half: 0.4, icon: 'Activity', accent: GREEN },
  search: { height: 40, half: 0.4, icon: 'Search', accent: VIOLET },
  ring: { height: 8, half: 0.2, icon: 'Hash', accent: BLUE },
  vault: { height: 46, half: 0.38, icon: 'KeyRound', accent: AMBER },
  warehouse: { height: 44, half: 0.5, icon: 'Warehouse', accent: TEAL },
  container: { height: 30, half: 0.4, icon: 'Container', accent: BLUE },
  // 1.6 tiles square, 70 high; the roof rhombus adds half * TILE above the height
  block: { height: 70, half: 0.8, reach: 70 + 0.8 * TILE, icon: 'Boxes', accent: BLUE },
};

/** Illustrated kinds are drawn larger than their data size so they hold their own next to blocks. */
export const FLAT_SCALE = 1.35;
/** Effective scale of a node: its `size` times the default enlargement of illustrated kinds. */
export const sizeOf = (n: { kind: NodeKind; size?: number }) => (n.size ?? 1) * (n.kind === 'block' ? 1 : FLAT_SCALE);

/** Screen point of a node's top, used as the anchor for packets and badges. */
export function nodeTop(at: [number, number], kind: NodeKind, size = 1): [number, number] {
  const [sx, sy] = project(at[0], at[1]);
  return [sx, sy - KIND_STYLES[kind].height * size];
}

/** Height above the floor where a connector meets an object, about where the eye expects it. */
export function attachZ(kind: NodeKind, size = 1): number {
  return Math.max(14, KIND_STYLES[kind].height * 0.4) * size;
}

/** Width of the label pill under a node (15 px bold text plus an icon). */
export const labelWidth = (label: string) => label.length * 8.6 + 46;
const SUB_CHAR = 7.4;

export type AnnKind = 'badge' | 'chip' | 'load';

/** One pill in the stack above a node. */
export interface AnnItem {
  key: string;
  kind: AnnKind;
  text: string;
  tone?: Tone;
  icon?: string;
  /** Load percentage, for kind 'load'. */
  value?: number;
}

/** Vertical distance between stacked pills. */
export const ANN_PITCH = 30;
export const LOAD_WIDTH = 116;

/** The pills above a node, top to bottom: badge, then chips, then the load pill nearest the object. */
export function annotItems(n: SceneNode, maxChips = 4): AnnItem[] {
  const out: AnnItem[] = [];
  if (n.badge) out.push({ key: `badge:${n.badge}`, kind: 'badge', text: n.badge });
  const chips = n.chips ?? [];
  const shown = chips.length > maxChips ? chips.slice(0, maxChips) : chips;
  shown.forEach((c, i) => {
    const chip: Chip = typeof c === 'string' ? { text: c } : c;
    out.push({ key: `chip:${i}:${chip.text}`, kind: 'chip', text: chip.text, tone: chip.tone, icon: chip.icon });
  });
  if (shown.length < chips.length) out.push({ key: 'more', kind: 'chip', text: `+${chips.length - shown.length} more` });
  if (n.load !== undefined) out.push({ key: 'load', kind: 'load', text: `${Math.round(n.load)}%`, value: n.load });
  return out;
}

export const annWidth = (a: AnnItem) => (a.kind === 'load' ? LOAD_WIDTH : a.text.length * (a.kind === 'chip' ? 7.9 : 7.3) + 22 + (a.icon ? 20 : 0));

/** How much annotation text is counter-scaled, and how many chips a node may show. */
export interface Zoom {
  /** For pills (13 px text). */
  ka: number;
  /** For label pills and sub lines. */
  kl: number;
  maxChips: number;
}
export const NO_ZOOM: Zoom = { ka: 1, kl: 1, maxChips: 4 };

/** Screen-space extent of a node with its label and pills, relative to its floor point. Shared with the validator. */
export function nodeBounds(n: SceneNode, z: Zoom = NO_ZOOM) {
  const st = KIND_STYLES[n.kind];
  const size = sizeOf(n);
  const items = annotItems(n, z.maxChips);
  const block = n.kind === 'block';
  let halfW = block
    ? st.half * 2 * C30 * TILE * size + 6
    : Math.max((st.half + 0.2) * size * 1.2247 * TILE, ((n.label ? labelWidth(n.label) : 0) / 2) * z.kl, (((n.sub?.length ?? 0) * SUB_CHAR) / 2) * z.kl);
  for (const it of items) halfW = Math.max(halfW, (annWidth(it) * z.ka) / 2);
  const top = (st.reach ?? st.height) * size + (items.length ? 12 + 24 * z.ka + ANN_PITCH * z.ka * (items.length - 1) : 6);
  const bottom = block ? st.half * TILE * size + 10 : (st.half + 0.2) * size * TILE + 7 + (n.label ? (n.sub ? 63 : 30) : n.sub ? 24 : 0) * z.kl;
  return { halfW, top, bottom };
}

export type ViewBox = [number, number, number, number];

/**
 * Frame one scene: the tightest box around its nodes and zones, with room for labels and badges.
 * The player computes this per step and glides the camera between steps, so a step with one
 * object shows it large instead of leaving it tiny inside the whole lesson's footprint.
 */
export function sceneViewBox(scene: Scene, z: Zoom = NO_ZOOM): ViewBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const n of scene.nodes) {
    const [sx, sy] = project(n.at[0], n.at[1]);
    const b = nodeBounds(n, z);
    grow(sx - b.halfW, sy + b.bottom);
    grow(sx + b.halfW, sy - b.top);
  }
  for (const z of scene.zones ?? []) {
    for (const [x, y] of [z.from, z.to, [z.from[0], z.to[1]], [z.to[0], z.from[1]]] as [number, number][]) {
      const [sx, sy] = project(x, y);
      grow(sx, sy);
    }
  }
  if (!Number.isFinite(minX)) return [-300, -200, 600, 400];
  const pad = 20;
  // A caption sits along the bottom edge of the stage; leave it a clear strip.
  if (scene.caption) maxY += 34;
  let x = minX - pad;
  let y = minY - pad;
  let w = maxX - minX + pad * 2;
  let h = maxY - minY + pad * 2;
  // A floor on the frame size keeps a one-object scene from being magnified absurdly.
  const minW = 380;
  const minH = 260;
  if (w < minW) {
    x -= (minW - w) / 2;
    w = minW;
  }
  if (h < minH) {
    y -= (minH - h) / 2;
    h = minH;
  }
  return [x, y, w, h];
}

/**
 * Re-frame a box so the drawing sits left of an overlay panel `panelPx` wide. Needs the stage size in
 * pixels: the frame is widened to the stage's aspect and the drawing is centered in what is left.
 */
export function frameBesidePanel(box: ViewBox, stage: { w: number; h: number }, panelPx: number): ViewBox {
  const [x, y, w, h] = box;
  const free = stage.w - panelPx;
  if (free < 120 || stage.h < 80) return box;
  const s = Math.min(free / w, stage.h / h);
  const vw = stage.w / s;
  const vh = stage.h / s;
  return [x + w / 2 - free / 2 / s, y + h / 2 - vh / 2, vw, vh];
}
