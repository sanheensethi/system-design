import { useCallback, useEffect, useState } from 'react';
import { CourseTree, Sidebar, TopBar } from './components/Chrome';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Home } from './components/Home';
import { LessonPlayer } from './components/LessonPlayer';
import { SearchPalette } from './components/Shell';
import { isSoundOn, onSoundChange, play, setSound } from './engine/sound';
import type { Lesson } from './engine/types';
import { allLessons, findLesson, loadLesson } from './lessons';

interface Route {
  lessonId?: string;
  step: number;
}

function parseHash(): Route {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts.length === 0 || parts[0] === 'map') return { step: 0 };
  const step = Math.max(0, (parseInt(parts[1] ?? '1', 10) || 1) - 1);
  return { lessonId: parts[0], step };
}

function initialDark(): boolean {
  try {
    const saved = localStorage.getItem('sdim.theme');
    if (saved) return saved === 'dark';
  } catch {
    /* ignore */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [dark, setDark] = useState(initialDark);
  const [soundOn, setSoundOn] = useState(isSoundOn);
  const [treeOpen, setTreeOpen] = useState(() => {
    try {
      return localStorage.getItem('sdim.tree') !== 'hidden';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('sdim.tree', treeOpen ? 'open' : 'hidden');
    } catch {
      /* the preference then lasts for this visit only */
    }
  }, [treeOpen]);

  useEffect(() => {
    let lastLesson = parseHash().lessonId;
    const onHash = () => {
      const r = parseHash();
      setRoute(r);
      // Scroll to the top when the page changes, not on every step.
      if (r.lessonId !== lastLesson && !location.hash.includes('map')) window.scrollTo({ top: 0 });
      lastLesson = r.lessonId;
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const unsub = onSoundChange(setSoundOn);
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try {
      localStorage.setItem('sdim.theme', dark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }, [dark]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearch((s) => !s);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const found = route.lessonId ? findLesson(route.lessonId) : undefined;

  // Each lesson's full content is its own small download, fetched when the lesson is opened.
  const [loaded, setLoaded] = useState<{ id: string; lesson?: Lesson; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!found) return;
    const id = found.lesson.id;
    let live = true;
    setLoaded((cur) => (cur?.id === id && cur.lesson ? cur : { id }));
    loadLesson(id)
      .then((lesson) => live && setLoaded({ id, lesson }))
      .catch((e: Error) => live && setLoaded({ id, error: e.message }));
    return () => {
      live = false;
    };
  }, [found, retry]);

  useEffect(() => {
    document.title = found ? `${found.lesson.title} · System Design in Motion` : 'System Design in Motion';
  }, [found]);

  const goStep = useCallback(
    (i: number) => {
      if (route.lessonId) location.hash = `#/${route.lessonId}/${i + 1}`;
    },
    [route.lessonId],
  );
  const goLesson = useCallback((id: string) => {
    play('open');
    location.hash = `#/${id}/1`;
  }, []);

  let body;
  if (!route.lessonId) body = <Home />;
  else if (!found)
    body = (
      <div className="not-found">
        <h1>That lesson isn't published yet.</h1>
        <a className="btn primary" href="#/">
          Back to the course map
        </a>
      </div>
    );
  else if (loaded?.id !== found.lesson.id || !loaded.lesson)
    body = (
      <div className="not-found">
        {loaded?.error ? (
          <>
            <h1>This lesson didn't download.</h1>
            <p style={{ color: 'var(--ink-3)' }}>Check your connection, then try again.</p>
            <button className="btn primary" onClick={() => setRetry((r) => r + 1)}>
              Try again
            </button>
          </>
        ) : (
          <p className="loading">Loading “{found.lesson.title}”…</p>
        )}
      </div>
    );
  else {
    const list = allLessons();
    const idx = list.findIndex((l) => l.lesson.id === found.lesson.id);
    const lesson = loaded.lesson;
    const step = Math.min(route.step, lesson.steps.length - 1);
    body = (
      <LessonPlayer
        key={lesson.id}
        lesson={lesson}
        chapter={found.chapter}
        lessonNumber={found.chapter.lessons.findIndex((l) => l.id === lesson.id) + 1}
        step={step}
        dark={dark}
        soundOn={soundOn}
        next={list[idx + 1]?.lesson}
        goStep={goStep}
        goLesson={goLesson}
      />
    );
  }

  const inLesson = !!found;
  // On wide screens the menu button shows or hides the docked course tree, so the lesson can take the
  // full width. On narrower screens the tree is never docked and the button opens the drawer instead.
  const onMenu = () => {
    if (inLesson && window.matchMedia('(min-width: 1280px)').matches) setTreeOpen((o) => !o);
    else setMenu(true);
  };
  return (
    <div className={`app ${inLesson ? 'has-tree' : ''} ${treeOpen ? '' : 'tree-hidden'}`}>
      <TopBar
        onMenu={onMenu}
        treeOpen={inLesson && treeOpen}
        onSearch={() => setSearch(true)}
        dark={dark}
        toggleDark={() => setDark((d) => !d)}
        soundOn={soundOn}
        toggleSound={() => setSound(!soundOn)}
      />
      <div className="app-body">
        {inLesson && treeOpen && (
          <aside className="tree-col">
            <CourseTree currentId={route.lessonId} />
          </aside>
        )}
        <main>
          <ErrorBoundary resetKey={route.lessonId ?? 'home'}>{body}</ErrorBoundary>
        </main>
      </div>
      <Sidebar open={menu} onClose={() => setMenu(false)} currentId={route.lessonId} />
      <SearchPalette open={search} onClose={() => setSearch(false)} />
    </div>
  );
}
