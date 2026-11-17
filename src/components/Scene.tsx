import { AnimatePresence, motion } from 'motion/react';
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { STAGGER, cycleLength, flowDuration, useClock, type Clock } from '../engine/clock';
import { ANN_PITCH, KIND_STYLES, TILE, annWidth, annotItems, frameBesidePanel, labelWidth, nodeTop, project, sceneViewBox, sizeOf, type AnnItem, type ViewBox, type Zoom as ZoomSet } from '../engine/iso';
import { hits, layoutScene, packetLabelBox, type Layout } from '../engine/layout';
import { LINK_DRAW, annKey, linkKey, planReveal, type RevealPlan } from '../engine/reveal';
import { arrowPoints, roundedPath, routeLink, type Route } from '../engine/route';
import type { Scene as SceneData, SceneFlow, SceneLink, SceneNode, SceneZone } from '../engine/types';
import { useElementSize, useMedia } from './hooks';
import { iconFor } from './icons';

const C = Math.cos(Math.PI / 6);
const T = TILE;
/** Height of the pedestal every object stands on. */
const PZ = 8;
/** Spring for objects that pop into the scene: a small overshoot. */
const POP = { type: 'spring', stiffness: 230, damping: 15 } as const;
const SETTLE = { type: 'spring', stiffness: 190, damping: 22 } as const;

/** Smallest text size, in screen pixels, that annotations may render at. */
const MIN_TEXT_PX = 13;
const MAX_ZOOM = 2.4;
/** Under this stage width (phones) text may grow less, and nodes show fewer chips. */
const NARROW_STAGE = 700;
/** Returns the counter-scale that keeps text drawn at `px` SVG units at least MIN_TEXT_PX tall on screen. */
interface ZoomCtx {
  of: (px: number) => number;
  maxChips: number;
  layout: Layout | null;
}
const Zoom = createContext<ZoomCtx>({ of: () => 1, maxChips: 4, layout: null });
const useZoom = () => useContext(Zoom);

interface SceneProps {
  scene: SceneData;
  playing: boolean;
  /** Changes whenever the flows should restart (new step or replay). */
  runKey: string;
  /** Shared clock. When omitted the scene runs its own. */
  clock?: Clock;
  /** When each element enters. Omitted: build the whole scene from empty. */
  plan?: RevealPlan;
}

export function Scene({ scene, playing, runKey, clock, plan: given }: SceneProps) {
  const own = useClock(playing && !clock, runKey);
  const plan = useMemo(() => given ?? planReveal(null, scene), [given, scene]);
  const byId = useMemo(() => new Map(scene.nodes.map((n) => [n.id, n])), [scene.nodes]);
  const sorted = useMemo(
    () => [...scene.nodes].sort((a, b) => a.at[0] + a.at[1] - (b.at[0] + b.at[1]) || a.at[0] - b.at[0]),
    [scene.nodes],
  );
  const routes = useMemo(() => {
    const m = new Map<string, { link: SceneLink; route: Route }>();
    for (const l of scene.links ?? []) {
      const a = byId.get(l.from);
      const b = byId.get(l.to);
      if (a && b) m.set(linkKey(l), { link: l, route: routeLink(a, b, l.route) });
    }
    return m;
  }, [scene.links, byId]);

  const svgRef = useRef<SVGSVGElement>(null);
  const stage = useElementSize(svgRef);
  const wide = useMedia('(min-width: 681px)');
  const narrowStage = stage.w > 0 && stage.w < NARROW_STAGE;
  const maxZoom = narrowStage ? 1.5 : MAX_ZOOM;
  const maxChips = narrowStage ? 2 : 4;
  // The info panel covers the right of the stage on wide screens, so frame the drawing in what is left.
  const panelPx = scene.panel && wide ? Math.min(320, stage.w * 0.42) + 20 : 0;
  // Frame the scene, then size annotations for the scale that frame gives, then frame again with their real size.
  const frame = useMemo(() => {
    const free = stage.w - panelPx;
    const known = stage.w > 0 && stage.h > 0 && free > 120;
    const kFor = (s: number) => (px: number) => Math.min(maxZoom, Math.max(1, MIN_TEXT_PX / (px * s)));
    let z: ZoomSet = { ka: 1, kl: 1, maxChips };
    let box = sceneViewBox(scene, z);
    if (known)
      for (let i = 0; i < 3; i++) {
        const k = kFor(Math.min(free / box[2], stage.h / box[3]));
        z = { ka: k(13), kl: k(12), maxChips };
        box = sceneViewBox(scene, z);
      }
    const target = panelPx ? frameBesidePanel(box, stage, panelPx) : box;
    const scale = known ? Math.min(free / box[2], stage.h / box[3]) : 1;
    return { z, target, scale };
  }, [scene, stage, panelPx, maxZoom, maxChips]);
  const vb = useCamera(frame.target);
  const zoom = useMemo<ZoomCtx>(() => {
    const of = (px: number) => Math.min(maxZoom, Math.max(1, MIN_TEXT_PX / (px * frame.scale)));
    const [x, y, w, h] = frame.target;
    const panelUnits = panelPx / frame.scale;
    const layout = stage.w > 0 ? layoutScene(scene.nodes, routes, frame.z, { x0: x, y0: y, x1: x + w - panelUnits, y1: y + h }) : null;
    return { of, maxChips, layout };
  }, [scene.nodes, routes, frame, maxZoom, maxChips, panelPx, stage.w]);

  return (
    <Zoom.Provider value={zoom}>
    <svg ref={svgRef} className="scene" viewBox={vb.map((v) => v.toFixed(1)).join(' ')} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Animated system diagram">
      <defs>
        <radialGradient id="floor-fade" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="floor-mask">
          <rect x={vb[0] - 400} y={vb[1] - 400} width={vb[2] + 800} height={vb[3] + 800} fill="url(#floor-fade)" />
        </mask>
        <filter id="hot-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>

      <Floor />

      <AnimatePresence>
        {(scene.zones ?? []).map((z) => (
          <Zone key={z.id} zone={z} />
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {[...routes.entries()].map(([key, { link, route }]) => (
          <LinkLine key={key} link={link} route={route} delay={plan.links.get(key)} instant={plan.instant} />
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {sorted.map((n) => (
          <Node key={n.id} node={n} delay={plan.nodes.get(n.id)} instant={plan.instant} />
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {[...routes.entries()].map(([key, { link, route }]) => (
          <LinkMark key={key} link={link} route={route} delay={plan.links.get(key)} instant={plan.instant} />
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {sorted.map((n) => (
          <NodeOverlay key={n.id} node={n} plan={plan} />
        ))}
      </AnimatePresence>

      <Flows scene={scene} byId={byId} routes={routes} clock={clock ?? own} start={plan.revealEnd} />
    </svg>
    </Zoom.Provider>
  );
}

/** Glide the camera to a new frame instead of cutting. */
function useCamera(target: ViewBox): ViewBox {
  const [vb, setVb] = useState(target);
  const cur = useRef(target);
  const key = target.join(',');
  useEffect(() => {
    const from = cur.current;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || from.join(',') === key) {
      cur.current = target;
      setVb(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - t0) / 650, 1);
      const e = 1 - Math.pow(1 - p, 3);
      const next = from.map((v, i) => v + (target[i] - v) * e) as ViewBox;
      cur.current = next;
      setVb(next);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return vb;
}

function Floor() {
  const lines = [];
  for (let i = -14; i <= 14; i++) {
    const [ax, ay] = project(i, -14);
    const [bx, by] = project(i, 14);
    const [cx, cy] = project(-14, i);
    const [dx, dy] = project(14, i);
    lines.push(<line key={`a${i}`} x1={ax} y1={ay} x2={bx} y2={by} />);
    lines.push(<line key={`b${i}`} x1={cx} y1={cy} x2={dx} y2={dy} />);
  }
  return (
    <g className="floor" mask="url(#floor-mask)">
      {lines}
    </g>
  );
}

function Zone({ zone }: { zone: SceneZone }) {
  const k = useZoom().of(15);
  const [x0, y0] = zone.from;
  const [x1, y1] = zone.to;
  const pts = [project(x0, y0), project(x1, y0), project(x1, y1), project(x0, y1)];
  const labelAt = project(x0, y1);
  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className={`zone zone-${zone.tone ?? 'blue'}`}>
      <polygon points={pts.map((p) => p.join(',')).join(' ')} />
      <text transform={`translate(${labelAt[0] + 12} ${labelAt[1] - 8}) scale(${k})`} className="zone-label">
        {zone.label}
      </text>
    </motion.g>
  );
}

/* ------------------------------------------------------------ connectors */

/** The line itself. A mask reveals it from source to target, so dashed styles can draw in too. */
function LinkLine({ link, route, delay, instant }: { link: SceneLink; route: Route; delay?: number; instant: boolean }) {
  const id = useId();
  const draw = !instant && delay !== undefined;
  return (
    <motion.g initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
      {draw && (
        <mask id={id} maskUnits="userSpaceOnUse" x={-3000} y={-3000} width={6000} height={6000}>
          <motion.path className="link-reveal" d={route.d} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: LINK_DRAW, delay, ease: 'easeOut' }} />
        </mask>
      )}
      <g mask={draw ? `url(#${id})` : undefined}>
        <motion.path className={`link link-${link.style ?? 'solid'}`} initial={{ d: route.d }} animate={{ d: route.d }} transition={{ duration: 0.5 }} />
      </g>
    </motion.g>
  );
}

/** Arrowheads and the label pill. They sit above the objects and appear once the line has finished drawing. */
function LinkMark({ link, route, delay, instant }: { link: SceneLink; route: Route; delay?: number; instant: boolean }) {
  const off = useZoom().layout?.links.get(linkKey(link)) ?? [0, 0];
  const arrow = link.arrow ?? 'end';
  const fresh = !instant && delay !== undefined;
  const end = route.pts[route.pts.length - 1];
  const start = route.pts[0];
  const w = link.label ? link.label.length * 7.8 + 20 : 0;
  const k = useZoom().of(13);
  return (
    <motion.g
      className="link-mark"
      initial={fresh ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.2, delay: fresh ? delay + LINK_DRAW : 0 }}
    >
      {arrow !== 'none' && <polygon className="arrow" points={arrowPoints(end, route.endDir)} />}
      {arrow === 'both' && <polygon className="arrow" points={arrowPoints(start, route.startDir)} />}
      {link.label && (
        <g transform={`translate(${(route.labelAt[0] + off[0]).toFixed(1)} ${(route.labelAt[1] + off[1]).toFixed(1)})`}>
          <g transform={`scale(${k})`} className={`link-pill link-pill-${link.labelTone ?? 'default'}`}>
            <rect x={-w / 2} y={-12} width={w} height={24} rx={12} />
            <text x={0} y={4.5} textAnchor="middle">
              {link.label}
            </text>
          </g>
        </g>
      )}
    </motion.g>
  );
}

/* ------------------------------------------------------------ drawing kit
 * Every object is drawn from the same few parts: sharp boxes, rounded slabs, cylinders, and flat
 * details placed on a face. Faces are addressed with affine matrices, so details are authored as
 * plain 2D rects and lines in that face's own coordinates.
 */

type Pt = [number, number];
const pt = (x: number, y: number, z: number): Pt => {
  const [sx, sy] = project(x, y);
  return [sx, sy - z];
};
const str = (pts: Pt[]) => pts.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');

/** Top face at height z. Coordinates: grid x and y in SVG units (tile = 64). */
const topM = (z: number) => `matrix(${C} 0.5 ${-C} 0.5 0 ${-z})`;
/** Front-left face (the plane y = hy). Coordinates: u along x, v up. */
const leftM = (hy: number) => `matrix(${C} 0.5 0 -1 ${-hy * T * C} ${hy * T * 0.5})`;
/** Front-right face (the plane x = hx). Coordinates: u along y, v up. */
const rightM = (hx: number) => `matrix(${-C} 0.5 0 -1 ${hx * T * C} ${hx * T * 0.5})`;

function Box({ hx, hy, z0, z1, top = 'f-top', left = 'f-left', right = 'f-right' }: { hx: number; hy: number; z0: number; z1: number; top?: string; left?: string; right?: string }) {
  return (
    <g>
      <polygon className={left} points={str([pt(-hx, hy, z0), pt(hx, hy, z0), pt(hx, hy, z1), pt(-hx, hy, z1)])} />
      <polygon className={right} points={str([pt(hx, hy, z0), pt(hx, -hy, z0), pt(hx, -hy, z1), pt(hx, hy, z1)])} />
      <polygon className={top} points={str([pt(-hx, -hy, z1), pt(hx, -hy, z1), pt(hx, hy, z1), pt(-hx, hy, z1)])} />
    </g>
  );
}

function RoundSlab({ hx, hy, z0, z1, r, top = 'f-top', side = 'f-left' }: { hx: number; hy: number; z0: number; z1: number; r: number; top?: string; side?: string }) {
  const k = r * (1 - Math.SQRT1_2);
  const L = (z: number) => pt(-hx + k, hy - k, z);
  const F = (z: number) => pt(hx - k, hy - k, z);
  const R = (z: number) => pt(hx - k, -hy + k, z);
  const rect = { x: -hx * T, y: -hy * T, width: 2 * hx * T, height: 2 * hy * T, rx: r * T };
  return (
    <g>
      <rect className={side} transform={topM(z0)} {...rect} />
      <polygon className={`${side} ns`} points={str([L(z1), F(z1), R(z1), R(z0), F(z0), L(z0)])} />
      <polygon className="shade" points={str([F(z1), R(z1), R(z0), F(z0)])} />
      <line x1={L(z0)[0]} y1={L(z0)[1]} x2={L(z1)[0]} y2={L(z1)[1]} />
      <line x1={R(z0)[0]} y1={R(z0)[1]} x2={R(z1)[0]} y2={R(z1)[1]} />
      <rect className={top} transform={topM(z1)} {...rect} />
    </g>
  );
}

function Cylinder({ r, z0, z1, body = 'f-left', top = 'f-top', bands = [] }: { r: number; z0: number; z1: number; body?: string; top?: string; bands?: number[] }) {
  const W = r * T * Math.SQRT2 * C;
  const D = r * T * Math.SQRT1_2;
  return (
    <g>
      <path className={body} d={`M ${-W} ${-z1} L ${-W} ${-z0} A ${W} ${D} 0 0 0 ${W} ${-z0} L ${W} ${-z1} Z`} />
      <path className="shade" d={`M 0 ${-z1} L 0 ${-z0 + D} A ${W} ${D} 0 0 0 ${W} ${-z0} L ${W} ${-z1} Z`} />
      {bands.map((b) => (
        <path key={b} className="f-none" d={`M ${-W} ${-b} A ${W} ${D} 0 0 0 ${W} ${-b}`} />
      ))}
      <ellipse className={top} cx={0} cy={-z1} rx={W} ry={D} />
    </g>
  );
}

const Top = ({ z, children }: { z: number; children: ReactNode }) => <g transform={topM(z)}>{children}</g>;
const Left = ({ hy, children }: { hy: number; children: ReactNode }) => <g transform={leftM(hy)}>{children}</g>;
const Right = ({ hx, children }: { hx: number; children: ReactNode }) => <g transform={rightM(hx)}>{children}</g>;

function Ped({ h, r = 0.14 }: { h: number; r?: number }) {
  return <RoundSlab hx={h} hy={h} z0={0} z1={PZ} r={r} top="f-ped" side="f-ped-side" />;
}

/** A Lucide glyph laid flat on a top face. */
function Glyph({ icon, z, span }: { icon: string; z: number; span: number }) {
  const Icon = iconFor(icon);
  const s = span / 24;
  return (
    <g transform={`${topM(z)} scale(${s})`} className="glyph">
      <Icon x={-12} y={-12} width={24} height={24} />
    </g>
  );
}

/** Horizontal vent or text lines on a face. */
function Lines({ u0, u1, vs }: { u0: number; u1: number; vs: number[] }) {
  return (
    <g className="thin">
      {vs.map((v) => (
        <line key={v} x1={u0} y1={v} x2={u1} y2={v} />
      ))}
    </g>
  );
}

/* ------------------------------------------------------------ the objects */

function Art({ node }: { node: SceneNode }) {
  const off = node.status === 'down';
  switch (node.kind) {
    case 'user':
      return (
        <g>
          <RoundSlab hx={0.36} hy={0.36} z0={0} z1={PZ} r={0.36} top="f-ped" side="f-ped-side" />
          <path className="f-soft" d="M -13 -8 C -13 -30 -8 -36 0 -36 C 8 -36 13 -30 13 -8 A 13 6.5 0 0 1 -13 -8 Z" />
          <circle className="f-top" cx={0} cy={-43} r={9.5} />
        </g>
      );

    case 'client': {
      const hx = 0.5;
      const hy = 0.36;
      const keys = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) keys.push(<rect key={`${r}-${c}`} x={-27 + c * 6.1} y={-12 + r * 6.4} width={4.6} height={4.6} rx={1} />);
      return (
        <g>
          <Ped h={0.64} />
          <RoundSlab hx={hx} hy={hy} z0={PZ} z1={PZ + 6} r={0.06} />
          <Top z={PZ + 6}>
            <g className="thin f-left">{keys}</g>
            <rect className="thin f-left" x={-9} y={9.5} width={18} height={9} rx={2} />
          </Top>
          {/* screen: a vertical panel hinged on the back edge */}
          <Left hy={-hy + 0.03}>
            <rect className="f-right" x={-hx * T} y={PZ + 6} width={hx * 2 * T} height={48} rx={4} />
            <rect className="f-top thin" x={-hx * T + 5} y={PZ + 11} width={hx * 2 * T - 10} height={38} rx={2} />
            <line className="thin" x1={-hx * T + 5} y1={PZ + 42} x2={hx * T - 5} y2={PZ + 42} />
            <circle className="f-acc ns" cx={-hx * T + 10} cy={PZ + 45.5} r={1.6} />
            <rect className="f-soft ns" x={-hx * T + 10} y={PZ + 27} width={34} height={11} rx={2} />
            <Lines u0={-hx * T + 10} u1={hx * T - 16} vs={[PZ + 22, PZ + 17]} />
          </Left>
        </g>
      );
    }

    case 'phone':
      return (
        <g>
          <Ped h={0.52} />
          <RoundSlab hx={0.22} hy={0.38} z0={PZ} z1={PZ + 6} r={0.07} top="f-right" />
          <Top z={PZ + 6}>
            <rect className="f-top thin" x={-11} y={-21} width={22} height={42} rx={3} />
            <rect className="f-soft ns" x={-8} y={-16} width={16} height={11} rx={2} />
            <Lines u0={-8} u1={6} vs={[0, 5, 10]} />
          </Top>
        </g>
      );

    case 'server': {
      const hx = 0.34;
      const hy = 0.4;
      return (
        <g>
          <Ped h={0.6} />
          <Box hx={hx} hy={hy} z0={PZ} z1={72} />
          <Left hy={hy}>
            {[16, 29, 42, 55].map((v, i) => (
              <g key={v}>
                <rect className="f-top thin" x={-17} y={v} width={34} height={9} rx={2} />
                <line className="thin" x1={-13} y1={v + 4.5} x2={2} y2={v + 4.5} />
                <circle className={off ? 'f-left ns' : i === 1 ? 'led led-b ns' : 'led ns'} cx={11} cy={v + 4.5} r={2} />
              </g>
            ))}
          </Left>
          <Right hx={hx}>
            <Lines u0={-16} u1={16} vs={[20, 27, 34, 41, 48, 55, 62]} />
          </Right>
          <Top z={72}>
            <rect className="f-soft thin" x={-12} y={-16} width={24} height={32} rx={3} />
          </Top>
        </g>
      );
    }

    case 'service': {
      const h = 0.36;
      return (
        <g>
          <Ped h={0.56} />
          <Box hx={h} hy={h} z0={PZ} z1={46} />
          <Left hy={h}>
            <rect className="f-top thin" x={-17} y={15} width={34} height={25} rx={3} />
            <rect className="f-soft ns" x={-16} y={33} width={32} height={6} rx={2} />
            <Lines u0={-12} u1={8} vs={[27, 21]} />
          </Left>
          <Right hx={h}>
            <Lines u0={-14} u1={14} vs={[20, 28, 36]} />
          </Right>
          <Glyph icon="Boxes" z={46} span={24} />
        </g>
      );
    }

    case 'worker': {
      const h = 0.36;
      return (
        <g>
          <Ped h={0.56} />
          <Box hx={h} hy={h} z0={PZ} z1={42} />
          <Left hy={h}>
            <circle className="f-soft thin" cx={0} cy={25} r={11} />
            <circle className="f-top thin" cx={0} cy={25} r={4} />
            <g className="thin">
              {[0, 60, 120].map((a) => (
                <line key={a} x1={-11 * Math.cos((a * Math.PI) / 180)} y1={25 - 11 * Math.sin((a * Math.PI) / 180)} x2={11 * Math.cos((a * Math.PI) / 180)} y2={25 + 11 * Math.sin((a * Math.PI) / 180)} />
              ))}
            </g>
          </Left>
          <Right hx={h}>
            <Lines u0={-14} u1={14} vs={[18, 25, 32]} />
          </Right>
          <Glyph icon="Cpu" z={42} span={24} />
        </g>
      );
    }

    case 'dns': {
      const h = 0.36;
      return (
        <g>
          <Ped h={0.56} />
          <Box hx={h} hy={h} z0={PZ} z1={44} />
          <Left hy={h}>
            {[34, 25, 16].map((v) => (
              <g key={v}>
                <circle className="f-acc ns" cx={-13} cy={v} r={2.2} />
                <line className="thin" x1={-7} y1={v} x2={15} y2={v} />
              </g>
            ))}
          </Left>
          <Right hx={h}>
            <Lines u0={-14} u1={14} vs={[18, 26, 34]} />
          </Right>
          <Glyph icon="Hash" z={44} span={24} />
        </g>
      );
    }

    case 'internet': {
      const R = 25;
      const cy = -PZ - R - 6;
      return (
        <g>
          <Ped h={0.56} r={0.3} />
          <ellipse className="shade" cx={0} cy={-PZ} rx={16} ry={7} />
          <circle className="f-soft" cx={0} cy={cy} r={R} />
          <ellipse className="f-none thin" cx={0} cy={cy} rx={R} ry={R * 0.36} />
          <ellipse className="f-none thin" cx={0} cy={cy} rx={R * 0.42} ry={R} />
          <line className="thin" x1={-R} y1={cy} x2={R} y2={cy} />
        </g>
      );
    }

    case 'lb':
      return (
        <g>
          <Ped h={0.68} />
          <RoundSlab hx={0.5} hy={0.5} z0={PZ} z1={24} r={0.12} top="f-soft" />
          <Glyph icon="Split" z={24} span={34} />
        </g>
      );

    case 'gateway': {
      const hx = 0.48;
      const hy = 0.32;
      return (
        <g>
          <Ped h={0.66} />
          <Box hx={hx} hy={hy} z0={PZ} z1={46} />
          <Left hy={hy}>
            {[-20, -5, 10].map((u) => (
              <rect key={u} className="f-soft thin" x={u} y={PZ + 5} width={10} height={24} rx={5} />
            ))}
          </Left>
          <Right hx={hx}>
            <Lines u0={-12} u1={12} vs={[20, 29, 38]} />
          </Right>
          <Glyph icon="Router" z={46} span={22} />
        </g>
      );
    }

    case 'db':
      return (
        <g>
          <Ped h={0.62} r={0.2} />
          <Cylinder r={0.36} z0={PZ} z1={60} body="f-soft" bands={[25, 42]} />
          <Glyph icon="Database" z={60} span={22} />
        </g>
      );

    case 'replica':
      return (
        <g>
          <Ped h={0.58} r={0.2} />
          <Cylinder r={0.33} z0={PZ} z1={50} bands={[22, 36]} top="f-soft" />
          <Glyph icon="Copy" z={50} span={19} />
        </g>
      );

    case 'shard':
      return (
        <g>
          <Ped h={0.6} r={0.2} />
          <Cylinder r={0.35} z0={PZ} z1={26} body="f-soft" />
          <Cylinder r={0.35} z0={30} z1={44} body="f-soft" />
          <Glyph icon="Layers" z={44} span={20} />
        </g>
      );

    case 'cache': {
      const pins = [-16, -6, 4, 14];
      return (
        <g>
          <Ped h={0.62} />
          <RoundSlab hx={0.42} hy={0.42} z0={PZ + 3} z1={22} r={0.07} top="f-soft" side="f-right" />
          <Left hy={0.42}>
            {pins.map((u) => (
              <line key={u} x1={u} y1={PZ + 3} x2={u} y2={PZ - 2} />
            ))}
          </Left>
          <Right hx={0.42}>
            {pins.map((u) => (
              <line key={u} x1={u} y1={PZ + 3} x2={u} y2={PZ - 2} />
            ))}
          </Right>
          <Top z={22}>
            <rect className="f-top thin" x={-17} y={-17} width={34} height={34} rx={4} />
          </Top>
          <Glyph icon="Zap" z={22} span={22} />
        </g>
      );
    }

    case 'cdn':
      return (
        <g>
          <Ped h={0.6} />
          <RoundSlab hx={0.4} hy={0.4} z0={PZ} z1={24} r={0.1} top="f-soft" />
          <Glyph icon="Earth" z={24} span={26} />
          <line x1={pt(0.26, -0.26, 24)[0]} y1={pt(0.26, -0.26, 24)[1]} x2={pt(0.26, -0.26, 48)[0]} y2={pt(0.26, -0.26, 48)[1]} />
          <circle className="f-acc" cx={pt(0.26, -0.26, 50)[0]} cy={pt(0.26, -0.26, 50)[1]} r={3.5} />
        </g>
      );

    case 'queue': {
      const hx = 0.72;
      const hy = 0.3;
      return (
        <g>
          <RoundSlab hx={0.9} hy={0.48} z0={0} z1={PZ} r={0.14} top="f-ped" side="f-ped-side" />
          <RoundSlab hx={hx} hy={hy} z0={PZ} z1={18} r={0.06} />
          {[-0.5, -0.17, 0.16, 0.49].map((dx) => (
            <g key={dx} transform={`translate(${project(dx, 0).join(' ')})`}>
              <Box hx={0.11} hy={0.2} z0={18} z1={31} top="f-soft" left="f-soft" right="f-soft" />
              <polygon className="shade" points={str([pt(0.11, 0.2, 18), pt(0.11, -0.2, 18), pt(0.11, -0.2, 31), pt(0.11, 0.2, 31)])} />
            </g>
          ))}
        </g>
      );
    }

    case 'storage': {
      const h = 0.4;
      return (
        <g>
          <Ped h={0.6} />
          <Box hx={h} hy={h} z0={PZ} z1={42} />
          <Left hy={h}>
            {[
              [-18, 26, true],
              [2, 26, false],
              [-18, 12, false],
              [2, 12, true],
            ].map(([u, v, a], i) => (
              <rect key={i} className={`${a ? 'f-soft' : 'f-top'} thin`} x={u as number} y={v as number} width={16} height={11} rx={2} />
            ))}
          </Left>
          <Right hx={h}>
            <Lines u0={-16} u1={16} vs={[18, 26, 34]} />
          </Right>
          <Glyph icon="Package" z={42} span={24} />
        </g>
      );
    }

    case 'limiter': {
      const h = 0.32;
      return (
        <g>
          <Ped h={0.52} />
          <Box hx={h} hy={h} z0={PZ} z1={44} />
          <Left hy={h}>
            {[
              [-14, 8, 'f-top'],
              [-6, 13, 'f-top'],
              [2, 18, 'f-soft'],
              [10, 24, 'f-acc'],
            ].map(([u, hgt, cls]) => (
              <rect key={u as number} className={`${cls} thin`} x={u as number} y={14} width={6} height={hgt as number} rx={1.5} />
            ))}
          </Left>
          <Right hx={h}>
            <Lines u0={-12} u1={12} vs={[18, 26, 34]} />
          </Right>
          <Glyph icon="Gauge" z={44} span={22} />
        </g>
      );
    }

    case 'monitor': {
      const hx = 0.4;
      return (
        <g>
          <Ped h={0.6} />
          <RoundSlab hx={0.24} hy={0.2} z0={PZ} z1={PZ + 4} r={0.06} />
          <Left hy={0}>
            <rect className="f-right" x={-3} y={PZ + 4} width={6} height={8} />
            <rect className="f-right" x={-hx * T} y={PZ + 12} width={hx * 2 * T} height={34} rx={4} />
            <rect className="f-top thin" x={-hx * T + 4} y={PZ + 16} width={hx * 2 * T - 8} height={26} rx={2} />
            <polyline className="f-none chart" points={`-18,${PZ + 22} -9,${PZ + 30} -2,${PZ + 25} 6,${PZ + 36} 13,${PZ + 28} 19,${PZ + 33}`} />
          </Left>
        </g>
      );
    }

    case 'search': {
      const h = 0.38;
      return (
        <g>
          <Ped h={0.58} />
          <Box hx={h} hy={h} z0={PZ} z1={40} />
          <Left hy={h}>
            <rect className="f-top thin" x={-18} y={24} width={36} height={10} rx={5} />
            <Lines u0={-14} u1={10} vs={[18, 13]} />
          </Left>
          <Right hx={h}>
            <Lines u0={-14} u1={14} vs={[18, 26, 34]} />
          </Right>
          <Glyph icon="Search" z={40} span={24} />
        </g>
      );
    }

    case 'ring':
      return <RoundSlab hx={0.2} hy={0.2} z0={0} z1={7} r={0.2} top="f-soft" side="f-left" />;

    case 'vault': {
      // A safe: heavy box with a round dial and a handle on the front.
      const h = 0.36;
      return (
        <g>
          <Ped h={0.56} />
          <Box hx={h} hy={h} z0={PZ} z1={46} />
          <Left hy={h}>
            <rect className="f-top thin" x={-19} y={PZ + 4} width={38} height={30} rx={3} />
            <circle className="f-soft thin" cx={-4} cy={PZ + 19} r={9} />
            <circle className="f-top thin" cx={-4} cy={PZ + 19} r={3} />
            <line className="thin" x1={-4} y1={PZ + 28} x2={-4} y2={PZ + 25} />
            <rect className="f-acc thin" x={10} y={PZ + 13} width={4} height={12} rx={2} />
          </Left>
          <Right hx={h}>
            <Lines u0={-14} u1={14} vs={[18, 26, 34]} />
          </Right>
          <Glyph icon="KeyRound" z={46} span={22} />
        </g>
      );
    }

    case 'warehouse': {
      // A wide, low building with roll-up doors: where analytics data lands.
      const hx = 0.5;
      const hy = 0.36;
      return (
        <g>
          <Ped h={0.68} />
          <Box hx={hx} hy={hy} z0={PZ} z1={44} />
          <Left hy={hy}>
            {[-24, 2].map((u) => (
              <g key={u}>
                <rect className="f-soft thin" x={u} y={PZ} width={22} height={22} rx={1.5} />
                <Lines u0={u + 2} u1={u + 20} vs={[PZ + 6, PZ + 11, PZ + 16]} />
              </g>
            ))}
          </Left>
          <Right hx={hx}>
            {[-14, 0].map((u) => (
              <rect key={u} className="f-top thin" x={u} y={26} width={10} height={8} rx={1} />
            ))}
          </Right>
          <Glyph icon="Warehouse" z={44} span={26} />
        </g>
      );
    }

    case 'container': {
      // A shipping-container style box with corrugated sides.
      const hx = 0.46;
      const hy = 0.3;
      return (
        <g>
          <Ped h={0.62} />
          <Box hx={hx} hy={hy} z0={PZ} z1={30} top="f-soft" />
          <Left hy={hy}>
            <g className="thin">
              {[-24, -16, -8, 0, 8, 16, 24].map((u) => (
                <line key={u} x1={u} y1={PZ + 3} x2={u} y2={27} />
              ))}
            </g>
          </Left>
          <Right hx={hx}>
            <line className="thin" x1={0} y1={PZ + 3} x2={0} y2={27} />
            <rect className="f-acc thin" x={-6} y={15} width={3} height={6} rx={1} />
            <rect className="f-acc thin" x={3} y={15} width={3} height={6} rx={1} />
          </Right>
        </g>
      );
    }

    case 'block':
      return null; // drawn by BlockArt
  }
}

/** The block: a soft isometric cube. Sharp faces are clipped to a rounded silhouette. */
function BlockArt({ tint }: { tint?: string }) {
  const cid = useId();
  const st = KIND_STYLES.block;
  const h = st.half;
  const H = st.height;
  const A = pt(-h, -h, H);
  const B = pt(h, -h, H);
  const Cc = pt(h, h, H);
  const D = pt(-h, h, H);
  const B0 = pt(h, -h, 0);
  const C0 = pt(h, h, 0);
  const D0 = pt(-h, h, 0);
  const sil = roundedPath([A, B, B0, C0, D0, D], 14, true);
  return (
    <g data-tint={tint}>
      <ellipse className="shade" cx={0} cy={4} rx={h * T * 1.25} ry={h * T * 0.62} />
      <clipPath id={cid}>
        <path d={sil} />
      </clipPath>
      <g clipPath={`url(#${cid})`}>
        <polygon className="b-left ns" points={str([D, Cc, C0, D0])} />
        <polygon className="b-right ns" points={str([Cc, B, B0, C0])} />
        <polygon className="b-top ns" points={str([A, B, Cc, D])} />
      </g>
      <polyline className="f-none crease" points={str([D, Cc, B])} />
      <line className="crease" x1={Cc[0]} y1={Cc[1]} x2={C0[0]} y2={C0[1]} />
      <path className="f-none" d={sil} />
    </g>
  );
}

function Node({ node, delay, instant }: { node: SceneNode; delay?: number; instant: boolean }) {
  const st = KIND_STYLES[node.kind];
  const size = sizeOf(node);
  const [sx, sy] = project(node.at[0], node.at[1]);
  const status = node.status ?? 'idle';
  const R = (st.half + 0.5) * T;
  const reach = (st.reach ?? st.height) * size;
  const tint = node.tint ?? (node.kind === 'block' ? 'blue' : undefined);
  const fresh = delay !== undefined;

  return (
    <motion.g
      className={`node node-${status} ${tint ? `tint-${tint}` : ''}`}
      style={tint ? undefined : ({ '--k': st.accent } as CSSProperties)}
      initial={instant ? false : { opacity: 0, x: sx, y: sy + 18 }}
      animate={{ opacity: status === 'dim' ? 0.28 : 1, x: sx, y: sy }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={fresh ? { ...POP, delay } : SETTLE}
    >
      {status === 'hot' && <ellipse className="hot-glow" cx={0} cy={-reach * 0.5} rx={R * Math.SQRT2 * C * size * (node.kind === 'block' ? 1.1 : 0.9)} ry={Math.max(reach * 0.6, 28)} filter="url(#hot-glow)" />}
      {(status === 'hot' || status === 'active' || status === 'ok') && (
        <motion.ellipse
          cx={0}
          cy={0}
          rx={R * Math.SQRT2 * C * size}
          ry={R * Math.SQRT1_2 * size}
          className={`halo halo-${status}`}
          animate={status === 'ok' ? { opacity: 0.9 } : { opacity: [0.35, 1, 0.35] }}
          transition={status === 'ok' ? { duration: 0.3 } : { duration: status === 'hot' ? 0.9 : 1.8, repeat: Infinity }}
        />
      )}
      <g className="art" transform={size === 1 ? undefined : `scale(${size})`}>
        {node.kind === 'block' ? <BlockArt tint={tint} /> : <Art node={node} />}
      </g>
      {status === 'down' && (
        <g transform={`translate(0 ${-reach - 4})`} className="down-mark">
          <circle r={12} />
          <path d="M -5 -5 L 5 5 M 5 -5 L -5 5" />
        </g>
      )}
    </motion.g>
  );
}

/**
 * Labels and pills live in their own layer above every object. If they were part of each node's
 * group, a node later in depth order would paint over the label of the node behind it.
 */
function NodeOverlay({ node, plan }: { node: SceneNode; plan: RevealPlan }) {
  const st = KIND_STYLES[node.kind];
  const size = sizeOf(node);
  const [sx, sy] = project(node.at[0], node.at[1]);
  const status = node.status ?? 'idle';
  const Icon = iconFor(st.icon);
  const below = (st.half + 0.2) * size * T + 22;
  const label = node.label ?? '';
  const lw = labelWidth(label);
  const delay = plan.nodes.get(node.id);
  const zc = useZoom();
  const kz = zc.of;
  const kl = kz(12);
  const items = annotItems(node, zc.maxChips);
  const [sdx, sdy] = zc.layout?.stacks.get(node.id) ?? [0, 0];
  // The bottom pill sits just above the object; the rest stack upward from it.
  const ka = kz(13);
  const base = -(st.reach ?? st.height) * size - 12 - 12 * ka;
  const block = node.kind === 'block';
  return (
    <motion.g
      className={`node-overlay node-${status}`}
      initial={plan.instant ? false : { opacity: 0, x: sx, y: sy + 18 }}
      animate={{ opacity: status === 'dim' ? 0.4 : 1, x: sx, y: sy }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={delay !== undefined ? { ...POP, delay } : SETTLE}
    >
      <g transform={`translate(${sdx} ${sdy})`}>
      <AnimatePresence>
        {items.map((it, i) => (
          <Ann key={it.key} item={it} y={base - ANN_PITCH * ka * (items.length - 1 - i)} k={ka} delay={plan.annotations.get(annKey(node.id, it.key))} instant={plan.instant} />
        ))}
      </AnimatePresence>
      </g>

      {block ? (
        <BlockText node={node} k={Math.min(kz(12), 1.6)} />
      ) : (
        /* The label group is counter-scaled about the top of its pill so it stays under the object. */
        <g transform={`translate(0 ${below - 15}) scale(${kl})`}>
          {label && (
            <g className="node-label" transform="translate(0 15)">
              <rect x={-lw / 2} y={-15} width={lw} height={30} rx={15} />
              <Icon x={-lw / 2 + 12} y={-8} width={16} height={16} className="node-label-icon" />
              <text x={-lw / 2 + 34} y={5.5} className="node-label-main">
                {label}
              </text>
            </g>
          )}
          {node.sub && (
            <text x={0} y={label ? 48 : 18} textAnchor="middle" className="node-label-sub">
              {node.sub}
            </text>
          )}
        </g>
      )}
    </motion.g>
  );
}

/** Upright text centered on the cube's faces: icon, label, then the sub line. */
function BlockText({ node, k }: { node: SceneNode; k: number }) {
  const Icon = iconFor(node.icon ?? 'Boxes');
  const size = sizeOf(node);
  // The stack keeps its own size and is centered on the middle of the cube, whatever the cube's scale.
  const total = node.sub ? 57 : 42;
  const top = -35 * size - total / 2;
  return (
    <g className={`block-text tint-${node.tint ?? 'blue'}`} transform={`translate(0 ${-35 * size}) scale(${k}) translate(0 ${35 * size})`}>
      <Icon x={-11} y={top} width={22} height={22} className="block-icon" />
      {node.label && (
        <text x={0} y={top + 39} textAnchor="middle" className="block-label">
          {node.label}
        </text>
      )}
      {node.sub && (
        <text x={0} y={top + 55} textAnchor="middle" className="block-sub">
          {node.sub}
        </text>
      )}
    </g>
  );
}

/** One pill of the stack above a node: a badge, a request chip, or the load bar. */
function Ann({ item, y, k, delay, instant }: { item: AnnItem; y: number; k: number; delay?: number; instant: boolean }) {
  const w = annWidth(item);
  const Icon = item.icon ? iconFor(item.icon) : null;
  const bar = 40;
  const load = item.value ?? 0;
  const loadClass = load >= 85 ? 'load-bad' : load >= 60 ? 'load-warn' : 'load-good';
  return (
    <motion.g
      initial={instant ? false : { opacity: 0, y: y - 8, scale: 0.6 }}
      animate={{ opacity: 1, y, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 300, damping: 20, delay: delay ?? 0 }}
    >
      <g transform={`scale(${k})`} className={`ann-body ann-${item.kind} ${item.kind === 'chip' ? `chip-${item.tone ?? 'default'}` : ''}`}>
        <rect x={-w / 2} y={-12} width={w} height={24} rx={12} />
        {item.kind === 'load' ? (
          <>
            <CpuGlyph x={-w / 2 + 8} />
            <rect className="load-track" x={-w / 2 + 28} y={-3.5} width={bar} height={7} rx={3.5} />
            <motion.rect className={`load-fill ${loadClass}`} x={-w / 2 + 28} y={-3.5} height={7} rx={3.5} initial={instant ? false : { width: 0 }} animate={{ width: (bar * Math.max(load, 3)) / 100 }} transition={{ duration: 0.5, delay: delay ?? 0 }} />
            <text x={w / 2 - 9} y={4.5} textAnchor="end">
              {item.text}
            </text>
          </>
        ) : Icon ? (
          <>
            <Icon x={-w / 2 + 8} y={-8} width={16} height={16} />
            <text x={-w / 2 + 30} y={4.5}>
              {item.text}
            </text>
          </>
        ) : (
          <text x={0} y={4.5} textAnchor="middle">
            {item.text}
          </text>
        )}
      </g>
    </motion.g>
  );
}

function CpuGlyph({ x }: { x: number }) {
  const Cpu = iconFor('Cpu');
  return <Cpu x={x} y={-7} width={14} height={14} />;
}

/* ------------------------------------------------------------ packets */

interface Track {
  pts: Pt[];
  cum: number[];
  total: number;
  /** arc[i] is true when the segment ending at pts[i] is a free hop through the air. */
  arc: boolean[];
  flow: SceneFlow;
}

type RouteMap = Map<string, { link: SceneLink; route: Route }>;

function Flows({ scene, byId, routes, clock, start }: { scene: SceneData; byId: Map<string, SceneNode>; routes: RouteMap; clock: Clock; start: number }) {
  const t = useSyncExternalStore(clock.subscribe, clock.get);
  const zc = useZoom();
  const kp = zc.of(12);
  const cycle = useMemo(() => cycleLength(scene), [scene]);
  const tracks = useMemo<Track[]>(() => {
    const out: Track[] = [];
    for (const flow of scene.flows ?? []) {
      const nodes = flow.path.map((id) => byId.get(id)).filter((n): n is SceneNode => !!n);
      if (nodes.length < 2) continue;
      const pts: Pt[] = [];
      const arc: boolean[] = [];
      const push = (p: Pt, hop: boolean) => {
        if (pts.length) arc.push(hop);
        pts.push(p);
      };
      const top = (n: SceneNode): Pt => {
        const [x, y] = nodeTop(n.at, n.kind, sizeOf(n));
        return [x, y - 10];
      };
      for (let i = 1; i < nodes.length; i++) {
        const a = nodes[i - 1];
        const b = nodes[i];
        const fwd = routes.get(`${a.id}>${b.id}`);
        const rev = routes.get(`${b.id}>${a.id}`);
        if (fwd || rev) {
          // Ride the connector. Hops between connectors are bridged in a straight line.
          const seq = fwd ? fwd.route.pts : [...rev!.route.pts].reverse();
          seq.forEach((p) => push(p, false));
        } else {
          push(top(a), false);
          push(top(b), true);
        }
      }
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      out.push({ pts, cum, total: cum[cum.length - 1], arc, flow });
    }
    return out;
  }, [scene.flows, byId, routes]);

  // Flows wait until the scene has finished building itself.
  const now = t - start;
  if (now < 0) return <g className="flows" />;

  return (
    <g className="flows">
      {tracks.map((tr, ti) => {
        const f = tr.flow;
        const dur = flowDuration(f);
        const tone = f.tone ?? 'request';
        const clockT = (f.repeat ?? true) ? now % cycle : now;
        const packets = [];
        for (let i = 0; i < (f.count ?? 1); i++) {
          const local = clockT - (f.delay ?? 0) - i * STAGGER;
          if (local < 0 || local > dur) continue;
          const pos = along(tr, easeInOut(local / dur));
          packets.push(
            <g key={i} transform={`translate(${pos[0].toFixed(1)} ${pos[1].toFixed(1)})`}>
              <circle r={7} className={`packet tone-${tone}`} />
              {f.label && i === 0 && !(zc.layout && hits(packetLabelBox(pos[0], pos[1], f.label, kp), zc.layout.obstacles)) && (
                <text x={13} y={-9} transform={`scale(${kp})`} className="packet-label">
                  {f.label}
                </text>
              )}
            </g>,
          );
        }
        return <g key={ti}>{packets}</g>;
      })}
    </g>
  );
}

function easeInOut(x: number) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

function along(tr: Track, p: number): Pt {
  const d = p * tr.total;
  for (let i = 1; i < tr.pts.length; i++) {
    if (d <= tr.cum[i]) {
      const seg = tr.cum[i] - tr.cum[i - 1] || 1;
      const k = (d - tr.cum[i - 1]) / seg;
      const a = tr.pts[i - 1];
      const b = tr.pts[i];
      // A small hop arc makes packets that fly free of a connector read as moving through the air.
      const hop = tr.arc[i - 1] ? Math.sin(k * Math.PI) * Math.min(seg * 0.12, 26) : 0;
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k - hop];
    }
  }
  return tr.pts[tr.pts.length - 1];
}
