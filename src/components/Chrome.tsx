import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, ChevronRight, FileText, Folder, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isCompleted } from '../engine/progress';
import { Credits } from './Credits';
import { BOOKS, allLessons } from '../lessons';

export function TopBar({
  onMenu,
  treeOpen,
  onSearch,
  dark,
  toggleDark,
  soundOn,
  toggleSound,
}: {
  onMenu: () => void;
  /** The docked course tree is showing (wide screens, in a lesson). */
  treeOpen: boolean;
  onSearch: () => void;
  dark: boolean;
  toggleDark: () => void;
  soundOn: boolean;
  toggleSound: () => void;
}) {
  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" onClick={onMenu} aria-label="Show or hide the course menu" title="Course menu">
        <Menu size={18} className="menu-ic" />
        {treeOpen ? <PanelLeftClose size={18} className="panel-ic" /> : <PanelLeftOpen size={18} className="panel-ic" />}
      </button>
      <a href="#/" className="brand">
        <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden>
          <path d="M16 3 29 10.5 16 18 3 10.5Z" fill="var(--accent)" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M3 10.5 16 18v11L3 21.5Z" fill="var(--obj-2)" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M29 10.5 16 18v11l13-7.5Z" fill="var(--obj-3)" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
        <span>System Design in Motion</span>
      </a>
      <button className="search-btn" onClick={onSearch}>
        <Search size={15} />
        <span>Search lessons and concepts</span>
        <kbd>Ctrl K</kbd>
      </button>
      <Credits />
      <div className="topbar-right">
        <button className="icon-btn" onClick={toggleSound} aria-label={soundOn ? 'Mute sound effects' : 'Turn sound effects on'} title="Sound effects">
          {soundOn ? <Volume2 size={17} /> : <VolumeX size={17} />}
        </button>
        <button className="icon-btn" onClick={toggleDark} aria-label="Switch theme" title="Theme">
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
    </header>
  );
}

const FOLDER_TONES = ['#F5A524', '#46A758', '#7C5CFC', '#F2762E', '#3E7BFA', '#12A594', '#E5484D', '#E93D82'];

/** The course as a folder tree with per-chapter progress. Used in the fixed left column and in the drawer. */
export function CourseTree({ currentId, onNavigate }: { currentId?: string; onNavigate?: () => void }) {
  const currentChapter = BOOKS.flatMap((b) => b.chapters).find((c) => c.lessons.some((l) => l.id === currentId))?.id;
  const [open, setOpen] = useState<Set<string>>(() => new Set(currentChapter ? [currentChapter] : ['foundations']));

  useEffect(() => {
    if (currentChapter) setOpen((s) => (s.has(currentChapter) ? s : new Set(s).add(currentChapter)));
  }, [currentChapter]);

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const lessons = allLessons();
  const done = lessons.filter((l) => isCompleted(l.lesson.id)).length;
  let tone = 0;

  return (
    <nav className="tree" aria-label="Course">
      <div className="tree-scroll">
        {BOOKS.map((book) => (
          <div key={book.id} className="tree-book">
            <div className="tree-book-title">{book.title}</div>
            {book.chapters.map((ch) => {
              const color = FOLDER_TONES[tone++ % FOLDER_TONES.length];
              const isOpen = open.has(ch.id);
              const chDone = ch.lessons.filter((l) => isCompleted(l.id)).length;
              return (
                <div key={ch.id} className="tree-chapter">
                  <button className="tree-row" onClick={() => toggle(ch.id)} aria-expanded={isOpen}>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <Folder size={16} fill={color} stroke="var(--ink)" strokeWidth={1.5} />
                    <span className="tree-name">
                      {ch.number}. {ch.title}
                    </span>
                    <span className="tree-count">{ch.lessons.length ? `${chDone}/${ch.lessons.length}` : 'soon'}</span>
                  </button>
                  {isOpen && (
                    <div className="tree-kids">
                      {ch.lessons.map((l) => (
                        <a key={l.id} href={`#/${l.id}/1`} className={`tree-lesson ${l.id === currentId ? 'current' : ''}`} aria-current={l.id === currentId ? 'page' : undefined} onClick={onNavigate}>
                          {isCompleted(l.id) ? <Check size={14} className="done-ic" strokeWidth={3} /> : <FileText size={14} />}
                          <span>{l.title}</span>
                        </a>
                      ))}
                      {(ch.planned ?? []).map((p) => (
                        <span key={p} className="tree-lesson planned">
                          <FileText size={14} />
                          <span>{p}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="tree-progress">
        <span>Progress</span>
        <div className="tree-bar">
          <i style={{ width: `${lessons.length ? (done / lessons.length) * 100 : 0}%` }} />
        </div>
        <b>
          {done} / {lessons.length}
        </b>
      </div>
    </nav>
  );
}

export function Sidebar({ open, onClose, currentId }: { open: boolean; onClose: () => void; currentId?: string }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside className="drawer" initial={{ x: -340 }} animate={{ x: 0 }} exit={{ x: -340 }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}>
            <div className="drawer-head">
              <span>Course</span>
              <button className="icon-btn" onClick={onClose} aria-label="Close the course menu">
                <X size={18} />
              </button>
            </div>
            <CourseTree currentId={currentId} onNavigate={onClose} />
            <Credits compact />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
