import { useEffect, useMemo, useRef } from 'react';
import type { Scene, SceneFlow } from './types';

/**
 * One pausable clock per scene. The packets and the packet log both read it, which is what keeps
 * the highlighted log row in step with the packet on screen.
 */
export interface Clock {
  subscribe(fn: () => void): () => void;
  get(): number;
}

export function useClock(playing: boolean, runKey: string): Clock {
  const t = useRef(0);
  const listeners = useRef(new Set<() => void>());
  const clock = useMemo<Clock>(
    () => ({
      subscribe(fn) {
        listeners.current.add(fn);
        return () => listeners.current.delete(fn);
      },
      get: () => t.current,
    }),
    [],
  );

  useEffect(() => {
    t.current = 0;
    listeners.current.forEach((l) => l());
  }, [runKey]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last: number | null = null;
    const tick = (now: number) => {
      if (last !== null) {
        t.current += Math.min((now - last) / 1000, 0.1);
        listeners.current.forEach((l) => l());
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, runKey]);

  return clock;
}

/** Seconds between packets in one burst. */
export const STAGGER = 0.24;
/** Pause at the end of a cycle before the choreography replays. */
const GAP = 0.9;

export const flowDuration = (f: SceneFlow) => f.duration ?? 1.6;
export const flowEnd = (f: SceneFlow) => (f.delay ?? 0) + flowDuration(f) + ((f.count ?? 1) - 1) * STAGGER;

/** All repeating flows in a scene share one cycle, so a sequence replays as a unit. */
export function cycleLength(scene: Scene): number {
  return Math.max(0, ...(scene.flows ?? []).map(flowEnd)) + GAP;
}
