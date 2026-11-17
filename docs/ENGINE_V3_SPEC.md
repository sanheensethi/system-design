# Engine v3: staged, zoomed, annotated scenes

Goal: a learner understands each step with the naked eye, without hunting. Every step builds itself in
front of them, piece by piece, with few large objects that carry their own labels. Every new field is
optional, so existing lessons keep working unchanged.

Read first: `src/engine/types.ts`, `src/engine/iso.ts`, `src/engine/clock.ts`, `src/components/Scene.tsx`,
`src/components/LessonPlayer.tsx`, `src/components/FlowLog.tsx`, `src/styles.css`,
`scripts/validate-lessons.mjs`, `docs/LESSON_AUTHORING.md`.

## 1. Staged reveal (the most important change)

When a step's scene appears, elements that were NOT in the previous step's scene enter in this order:

1. New nodes, one at a time in array order: pop up from 18px below with a small overshoot, 0.22 s apart.
2. New links: the connector draws itself from source to target (`pathLength` 0 to 1), 0.15 s apart,
   each about 0.45 s long. Arrowheads and link label chips fade in when their line finishes.
3. Node chips, badges and load bars of new or changed nodes pop in, 0.08 s apart.
4. The info panel (section 4) slides in.
5. Flows start only after all of the above. Implement this by giving the scene clock a start offset:
   flows (and the highlighted row in `FlowLog`) use `max(0, t - revealEnd)`, where `revealEnd` is the
   time the last reveal item finishes plus 0.2 s.

Elements that persist from the previous step (same id) do not re-enter: they animate to their new
position or state as today. Removed elements fade out quickly (0.2 s).

The "Replay" button replays the whole build of the current step, not only the flows: remount the scene
for that step with every element treated as new. Moving to a step for the first time in a lesson (and
the first step on lesson load) also builds from empty.

`prefers-reduced-motion: reduce`: no staging, everything appears at once, flows start immediately.

Keep the per-step camera; it should settle before the first node pops (the camera glide already takes
650 ms; start the reveal at about 250 ms so they overlap pleasantly).

## 2. Big readable objects

### 2a. New node kind `block`

A large rounded isometric cube (hexagonal silhouette with rounded corners, like a soft cube seen from
the iso angle), for abstract things: an API, a service, GraphQL, a "Users service". Footprint about
1.6 by 1.6 tiles, height about 70 SVG units. Upright (not skewed) text is drawn centered on it:

- an icon on top (`node.icon`, a Lucide icon name; map the names you need in `components/icons.tsx`,
  fall back to `Boxes`),
- `label` in bold, 15 to 16 px,
- `sub` underneath in 11 to 12 px.

A `block` has no separate label pill below it. Its colors come from `node.tint`.

### 2b. `tint` on any node

`tint?: 'blue' | 'green' | 'amber' | 'violet' | 'red' | 'gray' | 'teal'`. For `block` it sets the face
colors (light top, mid left, darker right, ink outline). For other kinds it replaces the kind's accent
color. Provide both light and dark theme values via CSS variables.

### 2c. Hot glow

`status: 'hot'` additionally gives the object a soft red glow (an SVG blur filter behind it) in addition
to the existing halo.

## 3. Annotations on nodes

- `chips?: (string | { text: string; tone?: 'default' | 'good' | 'warn' | 'bad'; icon?: string })[]`:
  a vertical stack of rounded pills above the node, in mono text, bordered in ink (see the reference:
  `GET /users/42`, `GET /users/42/posts` stacked). Up to 4. They replace the badge position; if a node
  has both `badge` and `chips`, the badge goes on top of the stack.
- `load?: number` (0 to 100): a small pill above the node with a CPU icon, a short bar and the
  percentage. Bar color: green under 60, amber under 85, red at 85 and above.

## 4. Info panel inside the stage

`scene.panel?: { title: string; icon?: string; rows?: { text: string; value?: string; tone?: 'default' | 'good' | 'warn' | 'bad' | 'muted' }[]; code?: string; footer?: { text: string; tone?: 'good' | 'warn' | 'bad' | 'muted' } }`

Rendered as HTML (not SVG) inside the stage, top right below the controls, max width 320 px: an ink
border, slight hard shadow, a small icon + title in the header, then either rows (text left, value right
aligned, a row with a tone gets a soft colored background) or a `code` block (mono, preserved line
breaks), then an optional footer row. It enters as step 4 of the reveal.

On screens up to 680 px wide the panel must not cover the drawing: render it below the stage, above the
timeline, at full width.

The camera framing must leave room for the panel on wide screens: when a panel is present, shift the
framed area so the drawing sits left of the panel (for example widen the view box on the right by the
panel's share of the stage width).

## 5. Connectors

- Links route as an elbow along the two isometric axes by default: from A go along grid x, then along
  grid y, to B (`route?: 'elbow' | 'straight'`, default `'elbow'`). Round the corner (radius about 10).
  Draw links at about mid-object height rather than on the floor so they meet objects where the eye
  expects. Pick an attachment height per kind (for example 40% of the kind's height).
- `arrow?: 'none' | 'end' | 'both'`, default `'end'`. Small solid arrowheads in ink.
- Link labels become bordered pills in mono text at the midpoint of the longer leg,
  `labelTone?: 'default' | 'good' | 'warn' | 'bad'` (warn = soft amber, as in "4G · 100 ms per round trip").
- Packets travel along the connector geometry when a link exists between two consecutive nodes of a
  flow (either direction); otherwise fall back to today's straight hop. Remove the hop arc for packets
  that ride a connector.

## 6. Metric chips

- `MetricDef.icon?: string` (Lucide name) shown before the label.
- `step.metricTones?: Record<string, 'good' | 'warn' | 'bad'>` gives that chip a 3 px colored left edge
  and tints the value text (good green, warn amber, bad red).

## 7. Zoom and density

- Lower the camera's minimum frame so a 2 or 3 object step fills the stage (try 380 by 260 and look).
- Increase label pill text to 15 px and node sub text to 12 px.
- Validator: warn when a step has more than 6 nodes ("keep steps to 3 to 6 objects so they read large");
  validate the new fields (chip count up to 4, `load` within 0 to 100, panel rows up to 6, panel code up
  to 8 lines, valid tones and tints, `block` nodes need a `label`). Update the screen-overlap boxes for
  `block` (wider, label inside) and for chips stacks (taller).

## 7b. Minimum readable size (hard requirement)

The owner could not read a 7-object step: the camera zoomed out until labels were about 9 px tall.
Text in the drawing must never render smaller than about 13 px on screen, at any zoom or stage size.

- Measure the rendered scale of the SVG (stage pixel size divided by view box size; use a
  ResizeObserver on the stage, and recompute when the camera frame changes).
- Counter-scale every annotation group (node label pills, sub lines, chips, badges, load bars, link
  label chips, packet labels, zone labels) by `max(1, 13 / (baseFontPx * scale))`, capped at about 2.4,
  scaling each around its own anchor point so it stays attached to its object. Replace the fixed
  `.lbl { transform: scale(1.4) }` phone rule with this.
- Objects themselves can still shrink, but give the camera a tighter frame: smaller padding, and the
  minimum frame from section 7.
- Validator: warn at more than 5 nodes per step (not 6).

## 8. Docs

Update `docs/LESSON_AUTHORING.md` with a short "v3 scene vocabulary" section: when to use `block` versus
an illustrated kind (blocks for abstract services and APIs, illustrated kinds for physical things like
phones, servers, databases), chips for the requests a node is handling, `load` for saturation, a panel
for the one table or snippet that explains the step, labeled links for the network condition, metric
tones for good and bad numbers, and 3 to 6 objects per step placed 2.5 to 3.5 tiles apart.

## Quality bar

- `npx tsc --noEmit` clean; `npm run validate` 0 errors on all lessons (existing lessons may get the new
  density warning; that is expected and will be fixed in the lesson upgrade pass).
- No layout break at 1600, 1280, 1024 and 390 px wide, light and dark themes, keyboard focus visible.
- Existing lessons still render correctly with none of the new fields.
