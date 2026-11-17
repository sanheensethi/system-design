import type { Step } from './types';

/**
 * How long autoplay lingers on a step before moving to the next one, in milliseconds.
 *
 * This is a teaching decision, not a technical one. Too short and people can't
 * read the explanation; too long and autoplay feels like a stalled slideshow.
 * Things a step can carry that might deserve more time: body text length, a key
 * idea, a code sample, the animation's own length (flows[].duration + delay), and
 * a quiz (where autoplay should probably stop and wait for the learner).
 *
 * Return `null` to pause autoplay on this step.
 */
export function stepDuration(step: Step): number | null {
  // TODO(you): replace this flat default with your own pacing rule (see note above).
  if (step.quiz) return null;
  return 9000;
}
