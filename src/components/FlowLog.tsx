import { useMemo, useState, useSyncExternalStore } from 'react';
import { cycleLength, flowEnd, type Clock } from '../engine/clock';
import type { Scene } from '../engine/types';

/** A packet-capture style table of the current step's messages, highlighted in time with the scene. */
export function FlowLog({ scene, clock, start = 0 }: { scene: Scene; clock: Clock; start?: number }) {
  // Open by default where there is room; on phones it starts folded so the explanation comes first.
  const [open, setOpen] = useState(() => window.matchMedia?.('(min-width: 1061px)').matches ?? true);
  const flows = scene.flows ?? [];
  if (flows.length === 0) return null;
  return (
    <details className="flowlog" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="flowlog-head">
        <h3>Messages in this step</h3>
        <span>{flows.length} in the loop</span>
      </summary>
      {open && <Rows scene={scene} clock={clock} start={start} />}
    </details>
  );
}

function Rows({ scene, clock, start: reveal }: { scene: Scene; clock: Clock; start: number }) {
  // Flows begin once the scene has finished building itself.
  const raw = useSyncExternalStore(clock.subscribe, clock.get);
  const building = raw < reveal;
  const t = Math.max(0, raw - reveal);
  const cycle = useMemo(() => cycleLength(scene), [scene]);
  const names = useMemo(() => new Map(scene.nodes.map((n) => [n.id, n.label ?? n.id])), [scene.nodes]);
  const rows = (scene.flows ?? []).map((flow, i) => ({ flow, i })).sort((a, b) => (a.flow.delay ?? 0) - (b.flow.delay ?? 0));
  return (
    <div className="flowlog-scroll">
      <table>
        <thead>
          <tr>
            <th>No.</th>
            <th>Time</th>
            <th>From</th>
            <th>To</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ flow, i }, n) => {
            const tone = flow.tone ?? 'request';
            const now = (flow.repeat ?? true) ? t % cycle : t;
            const start = flow.delay ?? 0;
            const state = building || now < start ? 'todo' : now <= flowEnd(flow) ? 'live' : 'done';
            const via = flow.path.length - 2;
            return (
              <tr key={i} className={state}>
                <td>
                  <i className={`num tone-bg-${tone}`}>{n + 1}</i>
                </td>
                <td>{start.toFixed(2)}s</td>
                <td>{names.get(flow.path[0])}</td>
                <td>
                  {names.get(flow.path[flow.path.length - 1])}
                  {via > 0 && <em> via {via}</em>}
                </td>
                <td>
                  {flow.label ?? tone}
                  {(flow.count ?? 1) > 1 && <em> ×{flow.count}</em>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
