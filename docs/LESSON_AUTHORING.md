# Writing a lesson

Lessons are pure data. The player in `src/components/LessonPlayer.tsx` renders any file that follows
`src/engine/types.ts`. Read both files, and read `src/lessons/request-lifecycle.ts` as the reference lesson
before writing a new one. Match its depth, tone and scene density.

## Shape of a lesson

- **One idea per step, and as many steps as the topic needs.** There is no step limit. A step's `body`
  is at most about 450 characters (two short paragraphs) and its scene shows that one idea. When a step
  wants a third paragraph, it is two steps: split it, never cut content. A lesson past about 24 steps
  becomes two lessons ("Part 1", "Part 2") so one sitting stays around 15 minutes.
- **Cover everything.** Before writing, list every sub-topic the sources cover for this lesson (the course
  owner's chapter text in `docs/source/`, the lesson's row and "deepen" notes in `docs/ROADMAP.md`, and
  for book topics the chapter in `docs/source/books/vol1.txt`). Every item on that list gets a step or
  a clear place in one. `learn` lists the main ones.
- Step 1 is a `problem` that makes the reader feel the pain. Middle steps alternate `concept`,
  `case` and `tradeoff`. The last step is a `recap` and carries a `quiz`. One extra quiz mid-lesson is welcome.
- Each step: a short nav `title` (1 to 3 words), a `heading`, 2 or 3 short paragraphs in `body`, and one
  `keyIdea` sentence the reader should keep.
- Every step has an `eli5`: the step's idea told to a five-year-old in one or two short sentences (under
  260 characters). Pick ONE everyday world per lesson and stay in it for every step, so the analogy
  grows with the lesson: a restaurant (host = load balancer, kitchen = server, pantry = database), a post
  office, a library, a school, a toy shop. Map it onto the objects in the scene by name, for example
  "The **load balancer** is the host at the door who points each family to a free table." No jargon in
  the eli5 except the one bolded term it explains. It must stay true: a simplification, never a wrong
  claim.
- Use concrete numbers and keep them consistent from step to step. Metric chips (`lesson.metrics` plus
  `step.metrics`) should change as the story moves: latency, hit rate, QPS, cost, replicas, and so on.
  Three to five metrics per lesson.
- Add `code` to two or three steps where code teaches something: a real config, a query, a 10 to 20 line
  implementation. Use `highlight` to point at the lines that matter.
- Build scenes progressively: introduce nodes when the story needs them, mark the interesting one `active`,
  overloaded ones `hot`, failed ones `down`, irrelevant ones `dim`, healthy outcomes `ok`. Use `badge` for
  the number or state the reader should look at. Use `zones` for regions, shards or datacenters.
- Flows tell the story. Sequence them with `delay` so they read in order (request, then response). All flows
  in a step loop together as one cycle. Use `tone` consistently: request, response, handshake, error, data
  (replication or copies) and event (async messages).

## Layout rules

- Grid coordinates `at: [x, y]` stay within -7..7. +x runs down-right on screen, +y runs down-left.
- Screen x is proportional to `x - y` and screen y to `x + y`. Two nodes with similar `x - y` stack
  vertically on screen even when they are far apart on the grid. The validator checks screen-space
  overlap; spread nodes by varying `x - y`.
- The camera frames each step on its own nodes and glides between steps, so a step with few nodes shows
  them large. Do not pad a scene with far-away nodes.
- A pool of identical servers reads best as a row across the screen: vary `x - y` by about 2.2 per server
  and keep `x + y` roughly constant. A node with a label and a sub line needs about 2.9 tiles of `x + y`
  from a node directly below it in the same screen column.
- Keep nodes at least 1.6 tiles apart or their labels collide. Lay a request path along a diagonal, roughly
  left to right: user/client near x = -5, the backend near x = +3 to +5.
- Reuse node objects across steps with spread (`{ ...server, status: 'hot' }`) so they animate in place.
  Keep a node's `id` and position stable across steps unless the move is the point.
- Labels are short (1 to 3 words). Put IPs, sizes or roles in `sub`.

## Writing style (enforced by the validator where it can be)

- American English. Short, direct sentences. Plain words. Explain like a senior engineer at a whiteboard.
- No em dashes or en dashes anywhere. Use commas, full stops, brackets or colons.
- Avoid: delve, leverage, robust, seamless, unlock, crucial, vital, pivotal, comprehensive, genuinely,
  essentially, "not X but Y" constructions, and rule-of-three padding.
- Inline formatting: `**bold**` for the term being introduced, backticks for code, commands and values.

## Check your work

    npx tsc --noEmit
    npm run validate -- <lesson-id> [<lesson-id> ...]

Both must pass with zero errors. Fix warnings unless you have a reason.

## v3 scene vocabulary

Every field below is optional. Existing lessons render without them, and the validator warns when a step has
more than 6 objects, because a step should read large at a glance.

- **Block or illustrated kind.** Use `block` for abstract things such as an API, GraphQL or a service. It is a
  large rounded cube that carries its own `icon`, `label` and `sub`, and takes its colors from `tint`. Use the
  illustrated kinds (`phone`, `server`, `db`, `cache`) for physical things. `tint` also recolors any other kind.
- **`chips`** are up to 4 pills above a node, in mono text, for the requests it is handling
  (`chips: ['GET /users/42', { text: 'GET /posts', tone: 'warn' }]`). Put the array in the order you want to read
  it, top to bottom. A `badge` sits on top of the stack.
- **`load`** (0 to 100) shows saturation as a CPU pill with a bar: green under 60, amber under 85, red above.
  Pair it with `status: 'hot'`, which also adds a red glow.
- **`scene.panel`** is the one table or snippet that explains the step, drawn in the stage. Use up to 6 `rows`
  (text, value, tone) or up to 8 lines of `code`, and an optional `footer`. Do not repeat the body text in it.
- **Links** route as an elbow along the grid axes by default, with an arrow at the end. Use `label` for the
  network condition ("4G · 100 ms per round trip") and `labelTone: 'warn'` when it is the problem. `arrow: 'both'`
  suits a two-way call, `route: 'straight'` suits a link that should not bend.
- **Metrics.** Give a `MetricDef` an `icon` (a Lucide name registered in `components/icons.tsx`), and set
  `step.metricTones` (`good`, `warn`, `bad`) so good and bad numbers are colored.
- **Staging.** A step builds itself in order: new objects, then new links, then chips and load bars, then the
  panel, then the flows start. Elements that were in the previous step stay put. Order `nodes` and `links` in the
  order the story should appear.
- **Density.** Use 3 to 6 objects per step, 2.5 to 3.5 tiles apart, so the camera can zoom in.
