import { AnimatePresence, motion } from 'motion/react';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { play } from '../engine/sound';
import { allLessons } from '../lessons';

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = allLessons().flatMap(({ lesson, chapter }) => [
      { kind: 'lesson', id: lesson.id, step: 1, title: lesson.title, where: `${chapter.number}. ${chapter.title}`, text: `${lesson.title} ${lesson.tagline} ${lesson.learn.join(' ')}` },
      ...lesson.steps.map((s, i) => ({
        kind: 'step',
        id: lesson.id,
        step: i + 1,
        title: s.heading,
        where: `${lesson.title}, step ${i + 1}`,
        text: `${s.title} ${s.heading} ${s.keyIdea}`,
      })),
    ]);
    if (!term) return rows.filter((r) => r.kind === 'lesson').slice(0, 30);
    const words = term.split(/\s+/);
    return rows.filter((r) => words.every((w) => r.text.toLowerCase().includes(w))).slice(0, 30);
  }, [q]);

  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      setTimeout(() => input.current?.focus(), 30);
    }
  }, [open]);

  const goto = (r: { id: string; step: number }) => {
    location.hash = `#/${r.id}/${r.step}`;
    play('open');
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="palette"
            role="dialog"
            aria-label="Search lessons"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
          >
            <div className="palette-input">
              <Search size={16} />
              <input
                ref={input}
                value={q}
                placeholder="Search lessons and concepts…"
                onChange={(e) => {
                  setQ(e.target.value);
                  setSel(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') onClose();
                  else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSel((s) => Math.min(s + 1, results.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSel((s) => Math.max(s - 1, 0));
                  } else if (e.key === 'Enter' && results[sel]) goto(results[sel]);
                }}
              />
              <kbd>Esc</kbd>
            </div>
            <ul className="palette-list">
              {results.length === 0 && <li className="palette-empty">Nothing matches “{q}”.</li>}
              {results.map((r, i) => (
                <li key={`${r.id}-${r.step}-${i}`}>
                  <button className={i === sel ? 'sel' : ''} onMouseEnter={() => setSel(i)} onClick={() => goto(r)}>
                    <span className="palette-title">{r.title}</span>
                    <span className="palette-where">{r.where}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
