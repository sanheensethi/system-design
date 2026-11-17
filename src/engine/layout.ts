import { ANN_PITCH, KIND_STYLES, TILE, annWidth, annotItems, labelWidth, project, sizeOf, type Zoom } from './iso';
import type { Route } from './route';
import type { SceneLink, SceneNode } from './types';

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Layout {
  /** Offset to apply to each node's pill stack, keyed by node id. */
  stacks: Map<string, [number, number]>;
  /** Offset to apply to each link label, keyed by `from>to`. */
  links: Map<string, [number, number]>;
  /** Everything a packet label must not be drawn over: objects, label pills, pill stacks, link labels. */
  obstacles: Box[];
}

const C = Math.cos(Math.PI / 6);
const INSET = 8;

const overlap = (a: Box, b: Box, pad = 3) => {
  const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + pad;
  const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + pad;
  return ox > 0 && oy > 0 ? ox * oy : 0;
};
const shift = (b: Box, dx: number, dy: number): Box => ({ x0: b.x0 + dx, x1: b.x1 + dx, y0: b.y0 + dy, y1: b.y1 + dy });
const outside = (b: Box, w: Box) => Math.max(0, w.x0 + INSET - b.x0) + Math.max(0, b.x1 - (w.x1 - INSET)) + Math.max(0, w.y0 + INSET - b.y0) + Math.max(0, b.y1 - (w.y1 - INSET));

interface Candidate {
  dx: number;
  dy: number;
  cost: number;
}

/** Offsets to try, cheapest first. Moving up is cheaper than moving sideways. */
function candidates(maxDx: number, maxDy: number, both: boolean): Candidate[] {
  const out: Candidate[] = [];
  for (let dy = 0; dy <= maxDy; dy += 10)
    for (let dx = 0; dx <= maxDx; dx += 16)
      for (const sy of dy === 0 || !both ? [-1] : [-1, 1])
        for (const sx of dx === 0 ? [1] : [-1, 1]) out.push({ dx: dx * sx, dy: dy * sy, cost: dy + dx * 1.3 });
  return out.sort((a, b) => a.cost - b.cost);
}
const STACK_MOVES = candidates(140, 150, false);
const LINK_MOVES = candidates(70, 50, true);

/**
 * A small layout pass in screen space. Objects and label pills stay put. Pill stacks and link labels
 * are nudged (up first, then sideways) until they stop covering anything, and are kept inside `bounds`.
 */
export function layoutScene(nodes: SceneNode[], routes: Map<string, { link: SceneLink; route: Route }>, z: Zoom, bounds: Box): Layout {
  const fixed: Box[] = [];
  const art = new Map<string, Box>();
  const labels = new Map<string, Box>();
  const stacks = new Map<string, Box>();
  const stackOff = new Map<string, [number, number]>();

  for (const n of nodes) {
    const st = KIND_STYLES[n.kind];
    const size = sizeOf(n);
    const [sx, sy] = project(n.at[0], n.at[1]);
    const reach = (st.reach ?? st.height) * size;
    const half = st.half * 2 * C * TILE * size;
    const a: Box = { x0: sx - half, x1: sx + half, y0: sy - reach, y1: sy + st.half * TILE * size };
    art.set(n.id, a);
    fixed.push(a);
    if (n.kind !== 'block' && (n.label || n.sub)) {
      const lw = (n.label ? labelWidth(n.label) : (n.sub?.length ?? 0) * 7.4) * z.kl;
      const y0 = sy + (st.half + 0.2) * size * TILE + 7;
      const l: Box = { x0: sx - lw / 2, x1: sx + lw / 2, y0, y1: y0 + (n.label ? (n.sub ? 63 : 30) : 24) * z.kl };
      labels.set(n.id, l);
      fixed.push(l);
    }
    const items = annotItems(n, z.maxChips);
    if (items.length) {
      const w = Math.max(...items.map(annWidth)) * z.ka;
      const bottom = sy - reach - 12;
      const top = bottom - 24 * z.ka - ANN_PITCH * z.ka * (items.length - 1);
      stacks.set(n.id, { x0: sx - w / 2, x1: sx + w / 2, y0: top, y1: bottom });
      stackOff.set(n.id, [0, 0]);
    }
  }

  const linkBox = new Map<string, Box>();
  const linkOff = new Map<string, [number, number]>();
  for (const [key, { link, route }] of routes) {
    if (!link.label) continue;
    const w = (link.label.length * 7.8 + 20) * z.ka;
    const h = 24 * z.ka;
    const [cx, cy] = route.labelAt;
    linkBox.set(key, { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 });
    linkOff.set(key, [0, 0]);
  }

  const settle = (id: string, box: Box, moves: Candidate[], others: Box[], own: Set<Box>): [Box, [number, number]] => {
    let best = box;
    let bestOff: [number, number] = [0, 0];
    let bestScore = Infinity;
    for (const m of moves) {
      const b = shift(box, m.dx, m.dy);
      let score = outside(b, bounds) * 50;
      for (const o of others) if (!own.has(o)) score += overlap(b, o);
      score = score * 1000 + m.cost;
      if (score < bestScore) {
        bestScore = score;
        best = b;
        bestOff = [m.dx, m.dy];
        if (score < 1000) break; // clear and inside: the cheapest such offset wins
      }
    }
    void id;
    return [best, bestOff];
  };

  const base = new Map<string, Box>([...stacks]);
  const linkBase = new Map<string, Box>([...linkBox]);
  for (let pass = 0; pass < 3; pass++) {
    for (const [id, b0] of base) {
      const others = [...fixed, ...[...stacks].filter(([k]) => k !== id).map(([, v]) => v), ...linkBox.values()];
      // A node's own object sits right under its stack by design.
      const own = new Set<Box>([art.get(id)!, labels.get(id)!].filter(Boolean));
      const [b, off] = settle(id, b0, STACK_MOVES, others, own);
      stacks.set(id, b);
      stackOff.set(id, off);
    }
    for (const [key, b0] of linkBase) {
      const others = [...fixed, ...stacks.values(), ...[...linkBox].filter(([k]) => k !== key).map(([, v]) => v)];
      const [b, off] = settle(key, b0, LINK_MOVES, others, new Set());
      linkBox.set(key, b);
      linkOff.set(key, off);
    }
  }

  return { stacks: stackOff, links: linkOff, obstacles: [...fixed, ...stacks.values(), ...linkBox.values()] };
}

/** Box of a packet label drawn at a packet position. */
export const packetLabelBox = (x: number, y: number, text: string, k: number): Box => ({ x0: x + 8, x1: x + 13 * k + text.length * 7.3 * k, y0: y - 9 * k - 13 * k, y1: y - 9 * k + 4 * k });

export const hits = (b: Box, boxes: Box[]) => boxes.some((o) => overlap(b, o, 0) > 0);
