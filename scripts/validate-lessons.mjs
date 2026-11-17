// Validates lesson data files: node references, layout collisions, metric keys, quiz answers, code highlights
// and house writing style. Run: node --experimental-strip-types scripts/validate-lessons.mjs [lesson-id ...]
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { nodeBounds, project } from '../src/engine/iso.ts';

const dir = resolve('src/lessons');
const only = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'index.ts' && (only.length === 0 || only.includes(f.replace(/\.ts$/, ''))));

const KINDS = new Set(['user', 'client', 'phone', 'dns', 'internet', 'lb', 'gateway', 'server', 'service', 'worker', 'db', 'replica', 'shard', 'cache', 'cdn', 'queue', 'storage', 'limiter', 'monitor', 'search', 'ring', 'vault', 'warehouse', 'container', 'block']);
const TINTS = new Set(['blue', 'green', 'amber', 'violet', 'red', 'gray', 'teal']);
const TONES = new Set(['default', 'good', 'warn', 'bad']);
const PANEL_TONES = new Set(['default', 'good', 'warn', 'bad', 'muted']);
const VERDICTS = new Set(['good', 'warn', 'bad']);
const TAGS = new Set(['problem', 'concept', 'case', 'tradeoff', 'recap', 'try']);
const BANNED = [/—/, /–/, /\bdelve\b/i, /\bleverage\b/i, /\brobust\b/i, /\bseamless/i, /\bcrucial\b/i, /\bvital\b/i, /\bpivotal\b/i, /\bcomprehensive\b/i, /\bgenuinely\b/i, /\bessentially\b/i];

let errors = 0;
let warnings = 0;
const err = (where, msg) => {
  errors++;
  console.log(`  ERROR ${where}: ${msg}`);
};
const warn = (where, msg) => {
  warnings++;
  console.log(`  warn  ${where}: ${msg}`);
};

function checkText(where, text) {
  for (const re of BANNED) if (re.test(text)) warn(where, `style: matches ${re} in "${text.slice(0, 70)}…"`);
}

for (const file of files) {
  const mod = await import(pathToFileURL(join(dir, file)).href);
  const lessons = Object.values(mod).filter((v) => v && typeof v === 'object' && Array.isArray(v.steps));
  if (lessons.length !== 1) {
    err(file, `expected exactly one exported Lesson, found ${lessons.length}`);
    continue;
  }
  const L = lessons[0];
  console.log(`${file}  (${L.id}, ${L.steps.length} steps)`);
  if (`${L.id}.ts` !== file) err(file, `lesson id "${L.id}" must match file name`);
  // No fixed step count: a lesson takes as many single-idea steps as its content needs. Very long
  // lessons are split into parts so one sitting stays around 15 minutes.
  if (L.steps.length < 6) warn(file, `has only ${L.steps.length} steps; is anything missing?`);
  if (L.steps.length > 24) warn(file, `has ${L.steps.length} steps; split it into "Part 1" and "Part 2" lessons`);
  const metricKeys = new Set((L.metrics ?? []).map((m) => m.key));
  [L.title, L.tagline, ...L.learn].forEach((t) => checkText(file, t));

  L.steps.forEach((s, i) => {
    const w = `${file} step ${i + 1}`;
    if (!TAGS.has(s.tag)) err(w, `bad tag ${s.tag}`);
    if (s.title.split(/\s+/).length > 3) warn(w, `step title "${s.title}" is longer than 3 words`);
    // One idea per step: if the explanation runs long, the step is carrying more than one idea.
    const bodyLen = (s.body ?? []).join(' ').length;
    if (bodyLen > 520) warn(w, `body is ${bodyLen} characters; one idea per step, split it (aim for 450 or less)`);
    if ((s.body ?? []).length > 3) warn(w, `body has ${s.body.length} paragraphs; one idea per step, split it`);
    if (!s.body?.length) err(w, 'empty body');
    if (!s.eli5) warn(w, 'missing eli5 (the five-year-old analogy)');
    else if (s.eli5.length > 260) warn(w, 'eli5 is longer than 260 characters; keep it to one or two short sentences');
    [s.heading, ...s.body, s.keyIdea ?? '', s.eli5 ?? '', s.scene.caption ?? ''].forEach((t) => checkText(w, t));
    const ids = new Map();
    for (const n of s.scene.nodes) {
      if (ids.has(n.id)) err(w, `duplicate node id ${n.id}`);
      ids.set(n.id, n);
      if (!KINDS.has(n.kind)) err(w, `node ${n.id} has unknown kind ${n.kind}`);
      if (Math.abs(n.at[0]) > 8 || Math.abs(n.at[1]) > 8) warn(w, `node ${n.id} at ${n.at} is far from center`);
      if (n.tint !== undefined && !TINTS.has(n.tint)) err(w, `node ${n.id} has unknown tint ${n.tint}`);
      if (n.kind === 'block' && !n.label) err(w, `block node ${n.id} needs a label (it is drawn on the block)`);
      if (n.chips !== undefined) {
        if (!Array.isArray(n.chips) || n.chips.length > 4) err(w, `node ${n.id} has more than 4 chips`);
        for (const c of n.chips ?? []) {
          const chip = typeof c === 'string' ? { text: c } : c;
          if (!chip.text) err(w, `node ${n.id} has a chip without text`);
          if (chip.tone !== undefined && !TONES.has(chip.tone)) err(w, `node ${n.id} chip has unknown tone ${chip.tone}`);
          checkText(w, chip.text ?? '');
        }
      }
      if (n.load !== undefined && !(n.load >= 0 && n.load <= 100)) err(w, `node ${n.id} load ${n.load} is outside 0..100`);
    }
    if (s.scene.nodes.length > 5) warn(w, `${s.scene.nodes.length} nodes: keep steps to 3 to 5 objects so they read large`);
    // Collision check in screen space: isometric projection can stack nodes that are far apart on the grid.
    const nodes = [...ids.values()];
    const box = (n) => {
      const [sx, sy] = project(n.at[0], n.at[1]);
      const e = nodeBounds(n); // the same extents the camera frames: label, pills, block roof
      return { x0: sx - e.halfW, x1: sx + e.halfW, y0: sy - e.top, y1: sy + e.bottom };
    };
    for (let a = 0; a < nodes.length; a++)
      for (let b = a + 1; b < nodes.length; b++) {
        const A = box(nodes[a]);
        const B = box(nodes[b]);
        const ox = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
        const oy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
        if (ox > 8 && oy > 6)
          warn(w, `nodes ${nodes[a].id} ${JSON.stringify(nodes[a].at)} and ${nodes[b].id} ${JSON.stringify(nodes[b].at)} overlap on screen (${Math.round(ox)}x${Math.round(oy)} px). Spread them along the screen horizontal: change x - y.`);
      }
    for (const l of s.scene.links ?? []) {
      if (!ids.has(l.from)) err(w, `link from missing node ${l.from}`);
      if (!ids.has(l.to)) err(w, `link to missing node ${l.to}`);
      if (l.route !== undefined && !['elbow', 'straight'].includes(l.route)) err(w, `link ${l.from}>${l.to} has bad route ${l.route}`);
      if (l.arrow !== undefined && !['none', 'end', 'both'].includes(l.arrow)) err(w, `link ${l.from}>${l.to} has bad arrow ${l.arrow}`);
      if (l.labelTone !== undefined && !TONES.has(l.labelTone)) err(w, `link ${l.from}>${l.to} has bad labelTone ${l.labelTone}`);
      checkText(w, l.label ?? '');
    }
    for (const f of s.scene.flows ?? []) {
      if (f.path.length < 2) err(w, 'flow path needs at least two nodes');
      for (const id of f.path) if (!ids.has(id)) err(w, `flow references missing node ${id}`);
    }
    const P = s.scene.panel;
    if (P) {
      if (!P.title) err(w, 'panel needs a title');
      if ((P.rows?.length ?? 0) > 6) err(w, `panel has ${P.rows.length} rows; the limit is 6`);
      if (P.code && P.code.trimEnd().split('\n').length > 8) err(w, 'panel code is longer than 8 lines');
      if (P.rows && P.code) warn(w, 'panel has both rows and code; only the code is shown');
      for (const r of P.rows ?? []) {
        if (r.tone !== undefined && !PANEL_TONES.has(r.tone)) err(w, `panel row has unknown tone ${r.tone}`);
        checkText(w, `${r.text} ${r.value ?? ''}`);
      }
      if (P.footer?.tone !== undefined && !['good', 'warn', 'bad', 'muted'].includes(P.footer.tone)) err(w, `panel footer has unknown tone ${P.footer.tone}`);
      checkText(w, `${P.title} ${P.footer?.text ?? ''}`);
    }
    for (const [k, v] of Object.entries(s.metricTones ?? {})) {
      if (!metricKeys.has(k)) err(w, `metricTones key ${k} not declared on lesson`);
      if (!VERDICTS.has(v)) err(w, `metricTones ${k} has bad value ${v}`);
    }
    for (const k of Object.keys(s.metrics ?? {})) if (!metricKeys.has(k)) err(w, `metric key ${k} not declared on lesson`);
    if (s.quiz) {
      if (s.quiz.answer < 0 || s.quiz.answer >= s.quiz.options.length) err(w, 'quiz answer index out of range');
      checkText(w, s.quiz.question + ' ' + s.quiz.explain + ' ' + s.quiz.options.join(' '));
    }
    if (s.code) {
      const lines = s.code.source.trimEnd().split('\n').length;
      for (const h of s.code.highlight ?? []) if (h < 1 || h > lines) err(w, `code highlight ${h} outside 1..${lines}`);
    }
  });
  const last = L.steps[L.steps.length - 1];
  if (last.tag !== 'recap') warn(file, 'last step should be a recap');
  if (!L.steps.some((s) => s.quiz)) warn(file, 'no quiz in this lesson');
}

console.log(`\n${files.length} lesson file(s), ${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
