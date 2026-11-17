import { motion } from 'motion/react';
import type { ScenePanel } from '../engine/types';
import { iconFor } from './icons';

/** The one table or snippet that explains a step. Slides in after the scene has built itself. */
export function StagePanel({ panel, delay, instant, below }: { panel: ScenePanel; delay: number; instant: boolean; below?: boolean }) {
  const Icon = iconFor(panel.icon ?? 'Table');
  return (
    <motion.aside
      className={`stage-panel ${below ? 'below' : ''}`}
      aria-label={panel.title}
      initial={instant ? false : below ? { opacity: 0, y: 12 } : { opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 260, damping: 26, delay }}
    >
      <div className="sp-head">
        <Icon size={16} />
        <span>{panel.title}</span>
      </div>
      {panel.code ? (
        <pre className="sp-code">{panel.code}</pre>
      ) : (
        panel.rows?.map((r, i) => (
          <div key={i} className={`sp-row sp-${r.tone ?? 'default'}`}>
            <span>{r.text}</span>
            {r.value && <b>{r.value}</b>}
          </div>
        ))
      )}
      {panel.footer && <div className={`sp-foot sp-${panel.footer.tone ?? 'muted'}`}>{panel.footer.text}</div>}
    </motion.aside>
  );
}
