import { ArrowRight, Check, Clock } from 'lucide-react';
import { lessonProgress } from '../engine/progress';
import type { Scene as SceneData } from '../engine/types';
import { BOOKS, allLessons } from '../lessons';
import { Scene } from './Scene';

const HERO: SceneData = {
  nodes: [
    { id: 'c', kind: 'client', at: [-3.4, 0.6], label: 'browser' },
    { id: 'lb', kind: 'lb', at: [-1, 0.4], label: 'load balancer' },
    { id: 's1', kind: 'server', at: [1.2, -1.4], label: 'app 1' },
    { id: 's2', kind: 'server', at: [2.6, 1.6], label: 'app 2' },
    { id: 'cache', kind: 'cache', at: [3.2, -3], label: 'cache' },
    { id: 'db', kind: 'db', at: [4.2, 0], label: 'database' },
    { id: 'q', kind: 'queue', at: [5, 3.8], label: 'queue' },
  ],
  links: [
    { from: 'c', to: 'lb' },
    { from: 'lb', to: 's1' },
    { from: 'lb', to: 's2' },
    { from: 's1', to: 'cache' },
    { from: 's1', to: 'db' },
    { from: 's2', to: 'db' },
    { from: 's2', to: 'q', style: 'dashed' },
  ],
  flows: [
    { path: ['c', 'lb', 's1', 'cache'], tone: 'request', duration: 1.8 },
    { path: ['cache', 's1', 'lb', 'c'], tone: 'response', duration: 1.8, delay: 1.9 },
    { path: ['c', 'lb', 's2', 'db'], tone: 'request', duration: 1.9, delay: 0.9 },
    { path: ['db', 's2', 'lb', 'c'], tone: 'response', duration: 1.9, delay: 2.9 },
    { path: ['s2', 'q'], tone: 'event', duration: 0.9, delay: 2.9 },
  ],
};

export function Home() {
  const lessons = allLessons();
  const firstId = lessons[0]?.lesson.id;
  const resume = lessons.find(({ lesson }) => {
    const p = lessonProgress(lesson.id, lesson.steps.length);
    return p > 0 && p < 1;
  });
  const steps = lessons.reduce((a, l) => a + l.lesson.steps.length, 0);

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-copy">
          <h1>Learn system design by watching it move</h1>
          <p>
            Each lesson is a short sequence of steps. A step poses a problem, shows what happens between the machines, and
            leaves you with one idea to keep. Free, with code where it helps.
          </p>
          <div className="hero-cta">
            {resume ? (
              <a className="btn primary" href={`#/${resume.lesson.id}/1`}>
                Resume “{resume.lesson.title}” <ArrowRight size={16} />
              </a>
            ) : (
              firstId && (
                <a className="btn primary" href={`#/${firstId}/1`}>
                  Start with lesson 1 <ArrowRight size={16} />
                </a>
              )
            )}
            <a className="btn" href="#map">
              Browse the course
            </a>
            <a className="btn" href="books/">
              Read the books
            </a>
          </div>
          <p className="hero-stats">
            {lessons.length} lessons and {steps} animated steps so far, starting from zero.
          </p>
        </div>
        <div className="hero-stage">
          <Scene scene={HERO} playing runKey="hero" />
        </div>
      </section>

      <section id="map" className="map">
        {BOOKS.map((book) => (
          <div key={book.id} className="book">
            <div className="book-head">
              <h2>{book.title}</h2>
              <p>{book.subtitle}</p>
            </div>
            {book.chapters.map((ch) => (
              <div key={ch.id} className="chapter">
                <h3>
                  <span className="chapter-num">{ch.number}</span> {ch.title}
                </h3>
                <div className="lesson-cards">
                  {ch.lessons.map((l) => {
                    const p = lessonProgress(l.id, l.steps.length);
                    return (
                      <a key={l.id} className="lesson-card" href={`#/${l.id}/1`}>
                        <div className="lc-title">{l.title}</div>
                        <div className="lc-tag">{l.tagline}</div>
                        <div className="lc-foot">
                          {p >= 1 ? (
                            <span className="lc-done">
                              <Check size={13} strokeWidth={3} /> Done
                            </span>
                          ) : (
                            <span>
                              <Clock size={13} /> {l.minutes} min, {l.steps.length} steps
                            </span>
                          )}
                          <span className="lc-level">{l.level}</span>
                        </div>
                        {p > 0 && p < 1 && (
                          <div className="lc-bar">
                            <i style={{ width: `${Math.round(p * 100)}%` }} />
                          </div>
                        )}
                      </a>
                    );
                  })}
                  {(ch.planned ?? []).map((p) => (
                    <div key={p} className="lesson-card planned">
                      <div className="lc-title">{p}</div>
                      <div className="lc-tag">Planned</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>

      <footer className="site-foot">
        Prefer to read? The full text lives in the <a href="books/">system design books</a>. In a lesson: arrow keys
        step, Space pauses, R replays, Ctrl K searches.
      </footer>
    </div>
  );
}
