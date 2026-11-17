# Brief for lesson authors

You are writing lessons for an animated system design course at E:\system-design (Vite + React + TypeScript).
Lessons are pure data files that a shared player renders as step-by-step isometric animations.

Read these first, in order:

1. `docs/LESSON_AUTHORING.md`: structure, layout rules, writing style, the `eli5` rule, how to verify.
2. `src/engine/types.ts`: the data model.
3. `src/lessons/caching.ts` and `src/lessons/replication.ts`: reference lessons. Match their depth, scene
   density and code quality.
4. `docs/ROADMAP.md`: find your lessons there. It gives the reason each lesson exists, what it must
   unblock, and for some a scene idea.

Rules:

- One file per lesson in `src/lessons/`, named `<id>.ts`, exporting one `Lesson` whose `id` equals the file
  name. Use the exact ids and titles you were given. The course map picks the file up by itself; do NOT
  edit `src/lessons/index.ts` or any file outside your own lesson files.
- One idea per step and no step limit (see the authoring guide): a body of at most about 450 characters,
  as many steps as the content needs, split past about 24 steps into Part 1 and Part 2. Never drop
  content to save steps. First step is a `problem`, last is a `recap` with a `quiz`, plus a quiz roughly
  every 8 steps. Code wherever code teaches something.
- Every step needs `eli5` (see the authoring guide). One everyday world per lesson.
- Write original prose and original examples. Reference material in `docs/source/` (the course owner's
  chapters, and `docs/source/books/vol1.txt`, a published book) is for checking which sub-topics to cover
  and getting facts right. Do not copy sentences, worked examples or diagram layouts from the published
  book.
- Be technically correct. If you are not sure of a number or a claim about a named company or product,
  leave it out or phrase it generically. List anything you were unsure about in your final report.
- A whole-system design lesson follows this arc: requirements and scale numbers, API, data model, the
  simple design, where it breaks, the fixes one at a time (each a step with the scene changing), failure
  cases, recap. Reuse building blocks taught earlier in the course by name.
- Verify from E:\system-design: `npx tsc --noEmit` and `npm run validate -- <id> <id> ...` must both end
  with 0 errors and 0 warnings for your lessons. The validator checks screen-space overlap; read the layout
  section of the authoring guide before placing nodes, and keep scenes to about 9 nodes or fewer.

For whole-system design lessons (ids starting with `design-`):

- 64 concept lessons already exist in `src/lessons/`. Refer to them by name in the prose ("the consistent
  hashing lesson") instead of re-teaching them; spend the steps on the decisions specific to this system.
- Put real numbers in the metric chips from the first step (users, QPS, storage, latency target) and keep
  them consistent as the design changes.
- Show at least one failure or scaling crisis and how the design survives it.
- Node kinds `vault` (keys, secrets), `warehouse` (analytics store) and `container` exist besides the
  ones in the authoring guide.

Final report, under 120 words: files written, anything you were unsure about, any engine limitation.
