/** Per-viewer progress, kept in localStorage. Every access is guarded because storage can be blocked. */

const KEY = 'sdim.progress.v1';

interface ProgressData {
  /** Highest step index reached per lesson. */
  reached: Record<string, number>;
  completed: Record<string, true>;
}

function read(): ProgressData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as ProgressData;
  } catch {
    /* fall through to empty progress */
  }
  return { reached: {}, completed: {} };
}

function write(data: ProgressData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* progress is a convenience; losing it is acceptable */
  }
}

export function markReached(lessonId: string, step: number, totalSteps: number) {
  const data = read();
  data.reached[lessonId] = Math.max(data.reached[lessonId] ?? 0, step);
  if (step >= totalSteps - 1) data.completed[lessonId] = true;
  write(data);
}

export function lessonProgress(lessonId: string, totalSteps: number): number {
  const data = read();
  if (data.completed[lessonId]) return 1;
  const r = data.reached[lessonId];
  return r === undefined ? 0 : (r + 1) / totalSteps;
}

export function isCompleted(lessonId: string) {
  return !!read().completed[lessonId];
}
