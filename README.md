# System Design in Motion

A free, visual system design course. Every lesson is a sequence of small steps: a problem, an animated
isometric scene of what happens between machines, the idea worth keeping, and code where it helps.
Content follows the HLD, LLD and AI system design books at https://sanheensethi.github.io/system-design/.

## Run it

    npm install
    npm run dev        # http://localhost:5173
    npm run build      # typecheck + static build into dist/
    npm run validate   # checks every lesson file (references, layout overlap, quizzes, style)

Keyboard in a lesson: left and right arrows step, Space pauses the animation, R replays, Ctrl K searches.

## How it is built

- `src/engine/types.ts`: the lesson data model. Lessons are plain data; no lesson contains animation code.
- `src/components/Scene.tsx`: isometric SVG renderer. Nodes are matched by `id` between steps, so a
  node that moves, appears or changes state animates on its own. Packets run on one pausable clock.
- `src/components/LessonPlayer.tsx`: stage, metric chips, step rail, narrative card, code, quiz, autoplay.
- `src/engine/sound.ts`: sound effects synthesized with Web Audio. No audio files.
- `src/lessons/`: one file per lesson. `src/lessons/index.ts` holds the course map; a lesson goes live as
  soon as its file exists. `vite.config.ts` generates a small index of all lessons for the map and
  search, and each lesson's full content downloads only when it is opened.
- `docs/LESSON_AUTHORING.md`: how to write a new lesson. Read it before adding one.

## Deploy

`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on every push to `main`.
Enable Pages with source "GitHub Actions" in the repository settings.

## Status

Live: 15 lessons in the foundations, traffic, data and communication stages. `docs/ROADMAP.md` lays out
the full zero-to-advanced path (142 lessons in 13 stages), what is missing, which live lessons need more
depth, and the suggested next 15 lessons in build order. The course map in `src/lessons/index.ts`
follows it.
