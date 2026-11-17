import { annotItems } from './iso';
import type { Scene, SceneLink } from './types';

/** Seconds into the step before the first object pops, so the camera glide has started. */
const START = 0.25;
const NODE_GAP = 0.22;
const NODE_SETTLE = 0.4;
const LINK_GAP = 0.15;
/** Seconds one connector takes to draw itself. */
export const LINK_DRAW = 0.45;
const ANN_GAP = 0.08;
const ANN_SETTLE = 0.3;
const PANEL_SETTLE = 0.35;
const FLOW_PAUSE = 0.2;

export const linkKey = (l: SceneLink) => `${l.from}>${l.to}`;
export const annKey = (nodeId: string, itemKey: string) => `${nodeId}|${itemKey}`;

/**
 * When each element of a step enters, in seconds from the moment the step appears. Only elements that
 * were not in the previous scene get a delay; everything else is absent from the maps and moves in place.
 */
export interface RevealPlan {
  /** Reduced motion: no staging, everything is there at once. */
  instant: boolean;
  nodes: Map<string, number>;
  links: Map<string, number>;
  /** Keyed by annKey: pills that are new on a new or changed node. */
  annotations: Map<string, number>;
  /** Delay for the info panel, or null when it is not new. */
  panel: number | null;
  /** Flows and the packet log start at this time. */
  revealEnd: number;
}

export const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Plan the build of `scene` given what was on screen before (null builds from empty). */
export function planReveal(prev: Scene | null, scene: Scene, reduce = prefersReducedMotion()): RevealPlan {
  const plan: RevealPlan = { instant: reduce, nodes: new Map(), links: new Map(), annotations: new Map(), panel: null, revealEnd: 0 };
  if (reduce) return plan;

  const prevNodes = new Map((prev?.nodes ?? []).map((n) => [n.id, n]));
  const prevLinks = new Set((prev?.links ?? []).map(linkKey));
  const ids = new Set(scene.nodes.map((n) => n.id));
  let cursor = START;
  let anything = false;

  const fresh = scene.nodes.filter((n) => !prevNodes.has(n.id));
  fresh.forEach((n, i) => plan.nodes.set(n.id, START + i * NODE_GAP));
  if (fresh.length) {
    cursor = START + (fresh.length - 1) * NODE_GAP + NODE_SETTLE;
    anything = true;
  }

  const newLinks = (scene.links ?? []).filter((l) => ids.has(l.from) && ids.has(l.to) && !prevLinks.has(linkKey(l)));
  newLinks.forEach((l, i) => plan.links.set(linkKey(l), cursor + i * LINK_GAP));
  if (newLinks.length) {
    cursor += (newLinks.length - 1) * LINK_GAP + LINK_DRAW;
    anything = true;
  }

  let k = 0;
  for (const n of scene.nodes) {
    const before = new Set(annotItems(prevNodes.get(n.id) ?? { id: n.id, kind: n.kind, at: n.at }).map((a) => a.key));
    for (const item of annotItems(n)) {
      if (before.has(item.key)) continue;
      plan.annotations.set(annKey(n.id, item.key), cursor + k * ANN_GAP);
      k++;
    }
  }
  if (k) {
    cursor += (k - 1) * ANN_GAP + ANN_SETTLE;
    anything = true;
  }

  if (scene.panel && JSON.stringify(scene.panel) !== JSON.stringify(prev?.panel)) {
    plan.panel = cursor;
    cursor += PANEL_SETTLE;
    anything = true;
  }

  plan.revealEnd = anything ? cursor + FLOW_PAUSE : 0;
  return plan;
}
