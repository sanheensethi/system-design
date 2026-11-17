import { KIND_STYLES, attachZ, project, sizeOf } from './iso';
import type { SceneLink, SceneNode } from './types';

export type Pt = [number, number];

export interface Route {
  /** Screen-space polyline from the edge of one object to the edge of the other. */
  pts: Pt[];
  /** SVG path with rounded corners. */
  d: string;
  /** Midpoint of the longest leg, where the label sits. */
  labelAt: Pt;
  /** Unit direction at the end and at the start, for arrowheads. */
  endDir: Pt;
  startDir: Pt;
}

const CORNER = 10;

const lift = (x: number, y: number, z: number): Pt => {
  const [sx, sy] = project(x, y);
  return [sx, sy - z];
};

/** Footprint radius in tiles that the connector stops short of. */
const radius = (n: SceneNode) => KIND_STYLES[n.kind].half * sizeOf(n) + 0.1;

/**
 * Route a link between two nodes. The default elbow runs along grid x, then grid y, so it follows the
 * isometric axes. Ends are trimmed to the object edges and lifted to about mid-object height.
 */
export function routeLink(a: SceneNode, b: SceneNode, mode: SceneLink['route'] = 'elbow'): Route {
  const [ax, ay] = a.at;
  const [bx, by] = b.at;
  const corner = mode === 'straight' || ax === bx || ay === by ? null : elbowCorner(a.at, b.at);
  let g: [number, number][] = corner ? [[ax, ay], corner, [bx, by]] : [[ax, ay], [bx, by]];

  // Trim along the first and last leg so the line starts and stops at the object edges.
  const trim = (from: [number, number], to: [number, number], r: number): [number, number] => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(r, len * 0.45) / len;
    return [from[0] + dx * k, from[1] + dy * k];
  };
  const first = trim(g[0], g[1], radius(a));
  const last = trim(g[g.length - 1], g[g.length - 2], radius(b));
  g = [first, ...g.slice(1, -1), last];

  // z runs from one end's attachment height to the other's, by distance along the path.
  const za = attachZ(a.kind, sizeOf(a));
  const zb = attachZ(b.kind, sizeOf(b));
  const cum = [0];
  for (let i = 1; i < g.length; i++) cum.push(cum[i - 1] + Math.hypot(g[i][0] - g[i - 1][0], g[i][1] - g[i - 1][1]));
  const total = cum[cum.length - 1] || 1;
  const pts = g.map(([x, y], i) => lift(x, y, za + (zb - za) * (cum[i] / total)));

  let best = 0;
  let bestLen = -1;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (len > bestLen) {
      bestLen = len;
      best = i;
    }
  }
  const labelAt: Pt = [(pts[best][0] + pts[best - 1][0]) / 2, (pts[best][1] + pts[best - 1][1]) / 2];
  return { pts, d: roundedPath(pts, CORNER), labelAt, endDir: dir(pts[pts.length - 2], pts[pts.length - 1]), startDir: dir(pts[1], pts[0]) };
}

/**
 * An elbow along the grid axes has two possible corners, mirror images through the middle of the on-screen
 * box of the two endpoints. If the corner lies inside that box the line runs smoothly from one to the other.
 * If it lies outside, any elbow would overshoot and double back, so the link goes straight instead.
 */
function elbowCorner(a: [number, number], b: [number, number]): [number, number] | null {
  const c: [number, number] = [b[0], a[1]];
  const pa = project(a[0], a[1]);
  const pb = project(b[0], b[1]);
  const q = project(c[0], c[1]);
  const inside = q[0] >= Math.min(pa[0], pb[0]) - 1 && q[0] <= Math.max(pa[0], pb[0]) + 1 && q[1] >= Math.min(pa[1], pb[1]) - 1 && q[1] <= Math.max(pa[1], pb[1]) + 1;
  return inside ? c : null;
}

function dir(a: Pt, b: Pt): Pt {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
}

const f = (n: number) => n.toFixed(1);

/** A polyline as an SVG path whose interior corners are rounded with a quadratic curve. */
export function roundedPath(pts: Pt[], r: number, closed = false): string {
  const n = pts.length;
  if (n < 2) return '';
  const at = (i: number) => pts[(i + n) % n];
  let d = '';
  for (let i = 0; i < n; i++) {
    const edge = !closed && (i === 0 || i === n - 1);
    if (edge) {
      d += `${i === 0 ? 'M' : 'L'} ${f(pts[i][0])} ${f(pts[i][1])} `;
      continue;
    }
    const p = at(i - 1);
    const v = pts[i];
    const q = at(i + 1);
    const l1 = Math.hypot(p[0] - v[0], p[1] - v[1]);
    const l2 = Math.hypot(q[0] - v[0], q[1] - v[1]);
    const r1 = Math.min(r, l1 / 2);
    const r2 = Math.min(r, l2 / 2);
    const s: Pt = [v[0] + ((p[0] - v[0]) / l1) * r1, v[1] + ((p[1] - v[1]) / l1) * r1];
    const e: Pt = [v[0] + ((q[0] - v[0]) / l2) * r2, v[1] + ((q[1] - v[1]) / l2) * r2];
    d += `${i === 0 ? 'M' : 'L'} ${f(s[0])} ${f(s[1])} Q ${f(v[0])} ${f(v[1])} ${f(e[0])} ${f(e[1])} `;
  }
  return closed ? d + 'Z' : d.trim();
}

/** Small solid arrowhead with its tip at `tip`, pointing along `dir`. */
export function arrowPoints(tip: Pt, dir: Pt, size = 9): string {
  const nx = -dir[1];
  const ny = dir[0];
  const bx = tip[0] - dir[0] * size;
  const by = tip[1] - dir[1] * size;
  const w = size * 0.55;
  return [tip, [bx + nx * w, by + ny * w], [bx - nx * w, by - ny * w]].map((p) => `${f(p[0])},${f(p[1])}`).join(' ');
}
