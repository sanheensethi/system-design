/**
 * Sound effects synthesized with the Web Audio API.
 *
 * Nothing is downloaded: every sound is a few oscillators and envelopes, so there
 * are no audio files to license and the site stays small. The AudioContext is
 * created lazily on the first user gesture because browsers block audio before it.
 */

type Cue = 'tick' | 'step' | 'send' | 'arrive' | 'success' | 'error' | 'open';

const STORAGE_KEY = 'sdim.sound';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = readEnabled();
const listeners = new Set<(on: boolean) => void>();

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

// Browsers refuse to start audio before the visitor interacts with the page.
// Stay silent until the first click, tap or key press instead of tripping that warning.
let unlocked = false;
if (typeof window !== 'undefined') {
  const unlock = () => {
    unlocked = true;
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (!enabled || !unlocked) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, out: master! };
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', peak = 0.6, glideTo?: number) {
  const a = audio();
  if (!a) return;
  const t0 = a.ctx.currentTime + start;
  const osc = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(start: number, dur: number, from: number, to: number, peak = 0.35) {
  const a = audio();
  if (!a) return;
  const t0 = a.ctx.currentTime + start;
  const len = Math.floor(a.ctx.sampleRate * dur);
  const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = a.ctx.createBufferSource();
  src.buffer = buf;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 6;
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(a.out);
  src.start(t0);
}

export function play(cue: Cue) {
  switch (cue) {
    case 'tick':
      tone(1400, 0, 0.04, 'triangle', 0.25);
      break;
    case 'open':
      tone(520, 0, 0.09, 'sine', 0.3);
      tone(780, 0.05, 0.12, 'sine', 0.25);
      break;
    case 'step':
      tone(660, 0, 0.12, 'sine', 0.35);
      tone(990, 0.07, 0.18, 'sine', 0.28);
      break;
    case 'send':
      noise(0, 0.32, 600, 3200, 0.25);
      break;
    case 'arrive':
      tone(1760, 0, 0.06, 'sine', 0.2);
      break;
    case 'success':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.22, 'triangle', 0.32));
      break;
    case 'error':
      tone(180, 0, 0.22, 'square', 0.18, 110);
      tone(150, 0.12, 0.22, 'square', 0.15, 90);
      break;
  }
}

export function isSoundOn() {
  return enabled;
}

export function setSound(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    /* storage can be blocked; the setting then lasts for this visit only */
  }
  listeners.forEach((l) => l(on));
  if (on) play('tick');
}

export function onSoundChange(fn: (on: boolean) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
