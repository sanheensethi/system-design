import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Baby, Check, Clock, GraduationCap, Lightbulb, ListOrdered, Maximize2, Pause, Play, RotateCcw, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { stepDuration } from '../engine/autoplay';
import { useClock } from '../engine/clock';
import { markReached } from '../engine/progress';
import { play } from '../engine/sound';
import { planReveal } from '../engine/reveal';
import type { Chapter, FlowTone, Lesson, LessonMeta, Scene as SceneData, StepTag } from '../engine/types';
import { CodePanel } from './CodePanel';
import { FlowLog } from './FlowLog';
import { useMedia } from './hooks';
import { iconFor } from './icons';
import { QuizCard } from './QuizCard';
import { RichText } from './RichText';
import { Scene } from './Scene';
import { StagePanel } from './StagePanel';

const TAG_LABEL: Record<StepTag, string> = {
  problem: 'Problem',
  concept: 'Concept',
  case: 'Case',
  tradeoff: 'Trade-off',
  recap: 'Recap',
  try: 'Try it',
};

const TONE_LABEL: Record<FlowTone, string> = {
  request: 'request',
  response: 'response',
  handshake: 'handshake',
  error: 'error or drop',
  data: 'data copy',
  event: 'event',
};

interface Props {
  lesson: Lesson;
  chapter: Chapter;
  lessonNumber: number;
  step: number;
  dark: boolean;
  soundOn: boolean;
  next?: LessonMeta;
  goStep: (i: number) => void;
  goLesson: (id: string) => void;
}

export function LessonPlayer({ lesson, chapter, lessonNumber, step, dark, soundOn, next, goStep, goLesson }: Props) {
  const total = lesson.steps.length;
  const current = lesson.steps[step];
  const [playing, setPlaying] = useState(true);
  const [autoplay, setAutoplay] = useState(false);
  const [replay, setReplay] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLOListElement>(null);
  const first = useRef(true);
  const runKey = `${lesson.id}-${step}-${replay}`;
  const clock = useClock(playing, runKey);
  const narrow = useMedia('(max-width: 680px)');

  // What was on screen before this step decides what is new. Replaying, or loading another lesson, builds from empty.
  const shown = useRef<{ lesson: string; replay: number; scene: SceneData } | null>(null);
  const plan = useMemo(() => {
    const p = shown.current;
    const base = p && p.lesson === lesson.id && p.replay === replay ? p.scene : null;
    return planReveal(base, current.scene);
  }, [lesson.id, replay, current.scene]);
  useEffect(() => {
    shown.current = { lesson: lesson.id, replay, scene: current.scene };
  }, [lesson.id, replay, current.scene]);
  const panelEl = current.scene.panel && (
    <AnimatePresence>
      <StagePanel key={JSON.stringify(current.scene.panel)} panel={current.scene.panel} delay={plan.panel ?? 0} instant={plan.instant} below={narrow} />
    </AnimatePresence>
  );

  const tones = useMemo(() => {
    const s = new Set<FlowTone>();
    lesson.steps.forEach((st) => st.scene.flows?.forEach((f) => s.add(f.tone ?? 'request')));
    return [...s];
  }, [lesson]);

  // Keep the current step visible when the timeline scrolls sideways on narrow screens.
  useEffect(() => {
    const rail = railRef.current;
    const el = rail?.querySelector<HTMLElement>('.tl-step.current');
    if (!rail || !el) return;
    rail.scrollTo({ left: el.offsetLeft - rail.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
  }, [step]);

  useEffect(() => {
    markReached(lesson.id, step, total);
    if (first.current) {
      first.current = false;
      return;
    }
    if (soundOn) play(step === total - 1 ? 'success' : 'step');
  }, [lesson.id, step, total, soundOn]);

  useEffect(() => {
    if (soundOn && replay > 0 && current.scene.flows?.length) play('send');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay]);

  const go = useCallback(
    (i: number) => {
      if (i < 0 || i >= total) return;
      goStep(i);
    },
    [goStep, total],
  );

  // Autoplay: advance after the step's dwell time, stop at the end or on a quiz.
  useEffect(() => {
    if (!autoplay) return;
    const ms = step >= total - 1 ? null : stepDuration(current);
    if (ms === null) {
      setAutoplay(false);
      return;
    }
    const id = setTimeout(() => go(step + 1), ms);
    return () => clearTimeout(id);
  }, [autoplay, step, total, current, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (el && el.tagName === 'BUTTON' && e.key === ' ') return; // let the focused button act
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'ArrowRight') go(step + 1);
      else if (e.key === 'ArrowLeft') go(step - 1);
      else if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key.toLowerCase() === 'r') setReplay((r) => r + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, step]);

  const fullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  const isLast = step === total - 1;
  const nav = (
    <>
      <button className="btn" onClick={() => go(step - 1)} disabled={step === 0}>
        <ArrowLeft size={16} /> Back
      </button>
      {isLast ? (
        next ? (
          <button className="btn primary grow" onClick={() => goLesson(next.id)}>
            <span>Next lesson: {next.title}</span>
            <ArrowRight size={16} />
          </button>
        ) : (
          <button className="btn primary grow" onClick={() => goStep(0)}>
            <span>Start over</span>
            <RotateCcw size={16} />
          </button>
        )
      ) : (
        <button className="btn primary grow" onClick={() => go(step + 1)}>
          <span>Next: {lesson.steps[step + 1].title}</span>
          <ArrowRight size={16} />
        </button>
      )}
    </>
  );

  return (
    <div className="lesson">
      <section className="workbench">
        <header className="lesson-head">
          <div className="crumbs">
            {chapter.number}. {chapter.title} <span className="sep">/</span> Lesson {lessonNumber} of {chapter.lessons.length}
          </div>
          <div className="lesson-title-row">
            <h1>{lesson.title}</h1>
            <div className="chips">
              <span className="chip">
                <Clock size={14} /> {lesson.minutes} min
              </span>
              <span className="chip">
                <GraduationCap size={14} /> {lesson.level}
              </span>
              <span className="chip">
                <ListOrdered size={14} /> {total} steps
              </span>
            </div>
          </div>
          <p className="tagline">{lesson.tagline}</p>
        </header>

        <div className="stage" ref={stageRef}>
          <div className="stage-top">
            <div className="metrics">
              {(lesson.metrics ?? []).map((m) => {
                const v = current.metrics?.[m.key] ?? '–';
                const Icon = m.icon ? iconFor(m.icon) : null;
                const verdict = current.metricTones?.[m.key];
                return (
                  <div className={`metric ${v === '–' ? 'empty' : ''} ${verdict ? `m-${verdict}` : ''}`} key={m.key}>
                    <span className="metric-label">
                      {Icon && <Icon size={13} />}
                      {m.label}
                    </span>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span key={v} className="metric-value" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.2 }}>
                        {v}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
            <div className="stage-controls">
              <button className="ctl" onClick={() => setReplay((r) => r + 1)} title="Replay (R)">
                <RotateCcw size={15} /> <span>Replay</span>
              </button>
              <button className="ctl" onClick={() => setPlaying((p) => !p)} title="Pause or play (Space)">
                {playing ? <Pause size={15} /> : <Play size={15} />} <span>{playing ? 'Pause' : 'Play'}</span>
              </button>
              <button className={`ctl ${autoplay ? 'on' : ''}`} onClick={() => setAutoplay((a) => !a)} title="Advance through the steps automatically" aria-pressed={autoplay}>
                <Sparkles size={15} /> <span>Auto</span>
              </button>
              <button className="ctl icon-only" onClick={fullscreen} title="Fullscreen" aria-label="Fullscreen">
                <Maximize2 size={15} />
              </button>
            </div>
          </div>

          <div className="scene-wrap">
            <Scene key={`${lesson.id}-${replay}`} scene={current.scene} playing={playing} runKey={runKey} clock={clock} plan={plan} />
            {current.scene.caption && <div className="caption">{current.scene.caption}</div>}
            {!narrow && panelEl}
          </div>

          {tones.length > 0 && (
            <div className="legend">
              {tones.map((t) => (
                <span key={t}>
                  <i className={`dot tone-bg-${t}`} /> {TONE_LABEL[t]}
                </span>
              ))}
            </div>
          )}
          {autoplay && <AutoBar key={runKey} ms={stepDuration(current)} />}
        </div>
        {narrow && panelEl}

        <nav className="timeline" aria-label="Steps in this lesson">
          <div className="timeline-head">
            <span>In this lesson</span>
            <span>
              Step {step + 1} of {total}
            </span>
          </div>
          <ol ref={railRef}>
            {lesson.steps.map((s, i) => (
              <li key={i}>
                <button
                  className={`tl-step ${i === step ? 'current' : ''} ${i < step ? 'done' : ''}`}
                  aria-current={i === step ? 'step' : undefined}
                  onClick={() => {
                    if (soundOn) play('tick');
                    go(i);
                  }}
                >
                  <span className="tl-num">{i < step ? <Check size={13} strokeWidth={3} /> : i + 1}</span>
                  <span className="tl-title">{s.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <FlowLog scene={current.scene} clock={clock} start={plan.revealEnd} />
      </section>

      <aside className="panel">
        <article className="step-card">
          <div className="step-meta">
            <span className="step-count">
              Step {step + 1} / {total}
            </span>
            <span className={`tag tag-${current.tag}`}>{TAG_LABEL[current.tag]}</span>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`${lesson.id}-${step}`} className="step-body" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <h2>{current.heading}</h2>
              {current.eli5 && (
                <div className="eli5">
                  <div className="eli5-label">
                    <Baby size={15} /> Like you're five
                  </div>
                  <p>
                    <RichText text={current.eli5} />
                  </p>
                </div>
              )}
              {current.body.map((p, i) => (
                <p key={i}>
                  <RichText text={p} />
                </p>
              ))}
              {current.keyIdea && (
                <div className="key-idea">
                  <div className="key-idea-label">
                    <Lightbulb size={15} /> Key idea
                  </div>
                  <p>
                    <RichText text={current.keyIdea} />
                  </p>
                </div>
              )}
              {current.code && <CodePanel code={current.code} dark={dark} />}
              {current.quiz && <QuizCard key={step} quiz={current.quiz} />}
              {isLast && !next && <p className="end-note">You have reached the end of the published lessons. More are on the way.</p>}
            </motion.div>
          </AnimatePresence>
          <div className="panel-nav">{nav}</div>
          <div className="hints">
            <kbd>←</kbd>
            <kbd>→</kbd> step <kbd>R</kbd> replay <kbd>Space</kbd> pause
          </div>
        </article>

        <section className="learn-card">
          <h3>You'll learn</h3>
          <ul>
            {lesson.learn.map((l, i) => {
              // Tick items off roughly in step with progress through the lesson.
              const done = isLast || (step + 1) / total > (i + 1) / lesson.learn.length;
              return (
                <li key={l} className={done ? 'done' : ''}>
                  <span className="box">{done && <Check size={12} strokeWidth={3} />}</span>
                  {l}
                </li>
              );
            })}
          </ul>
        </section>
      </aside>

      <footer className="step-nav">{nav}</footer>
    </div>
  );
}

function AutoBar({ ms }: { ms: number | null }) {
  if (ms === null) return null;
  return <motion.div className="autobar" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: ms / 1000, ease: 'linear' }} />;
}
