# Pre-release review — v0.2.1 → next

Findings from reviewing the whole diff against the last release (the `src/`
restructure, the hypergraph view, shared selection, `edgeColors`). Build, lint,
typecheck and all 50 interaction tests pass as of `dfe5be7`.

Work through in order; tick as they land.

---

## Bugs

### 1. An unrecognised `view-mode` renders nothing, not the graph

- [x] **Done.** Fixed by *reporting* rather than falling back — a mode is one of
      four and picking one on the author's behalf is a guess. `VIEW_MODES` now
      backs both the runtime check and the `ViewMode` type, and is exported.
      Covered by `Other` → `8. Errors`, which fails if the check is removed.

`src/zxDiagram.ts:227-230`

```ts
if (this.viewMode === 'graph') this.scene = scene
else if (both) { this.scene = layout(this.diagram, { scale: scene.scale * HYPERGRAPH_ZOOM }) }
```

For any other value neither branch fires, `hypergraph` is already `null`, and
`render()` returns `nothing` — a blank element with no error state. Three places
promise otherwise: the property docstring at `zxDiagram.ts:68`, CLAUDE.md, and
the `color-scheme` analogy both of those draw.

`view-mode` is a plain string attribute, and the mode replaced a boolean
`view-as-hypergraph` this release, so `view-mode="both"` is the obvious typo —
and it silently blanks the diagram.

**Fix:** `if (this.viewMode !== 'hypergraph') this.scene = both ? layout(…) : scene`.

**Test:** no story covers a bad value. Add one asserting an unknown `view-mode`
still draws `zx-viewer`.

---

### 2. The selected-edge casing gap is a no-op

- [x] **Done** in `bf9a0dd`. Gap restored at 5px, with
      `CASING_WIDTH = 3 + CASING_GAP_WIDTH` so the blue stays 1.5px either side
      whatever the gap is set to. The story assertion now compares the three
      stroke widths (`wire < gap < casing`) rather than only their colours, so a
      gap that strokes nothing can't pass again. The Pauli-web gotcha in
      CLAUDE.md is accurate once more: a 5px opaque band over a 7px strand.

`src/graph/viewer.ts:60` — `CASING_GAP_WIDTH = 0`, set in `7e1d075` ("Tweak wire
select widths"). The entire `path.gap` layer strokes nothing.

Still standing behind a band that isn't painted:

- ~15 lines of comment at `graph/viewer.ts:45-59`
- the `CANVAS_FILL` "shared so those two cannot drift apart" rationale,
  `colors.ts:80-84`
- the `<zx-diagram>` paragraph in CLAUDE.md ("a band of `CANVAS_FILL` between
  the two…")
- the CLAUDE.md **Gotcha** "a Pauli-web strand disappears under a selected
  edge" — now simply false
- `stories/hypergraphs/Interactions.stories.ts:368-372`, which asserts the gap
  path's `stroke` and `d` and **passes** — it never checks the width, so it
  certifies a band that isn't drawn

Also decide while here: `CASING_WIDTH = 3` against `LINK_WIDTH = 1.5` leaves
0.75px of blue either side. That is the only marker a selected edge gets.

**Fix:** either restore a visible gap, or delete `CASING_GAP_WIDTH`,
`CASING_GAP_STYLE`, the second `cased.map`, the shared-`CANVAS_FILL`
justification, the gotcha, and that assertion.

---

### 3. Self-loop dots miss their wire in `both` modes

- [x] **Done.** `layoutHypergraph` now zooms the resolved node positions *before*
      building the curves, and `at()` is a plain `curvePointAt`. Only self-loops
      move: every other curve shape is homogeneous in its endpoints, so scaling
      the endpoints and scaling the evaluated point are the same operation.
      `Other/Both viewers` → `6. Self-loop dots` asserts all three dots land on
      their own curve.

`src/hypergraph/layout.ts:189-192`

`edgeCurve`'s self-loop spread is a fixed 40px — the one thing in the geometry
that isn't proportional to `scale`.

- The hypergraph builds the curve from **unzoomed** positions and zooms the
  point that comes off it: dot at `y·1.6 − 48`.
- `<zx-viewer>` in a `both` mode builds the same curve from **zoomed**
  endpoints: loop midpoint at `y·1.6 − 30`.

18px apart, in the one mode whose entire purpose is that a dot sits on the
midpoint of the wire it stands for. The comment there argues for unzoomed
coordinates *because* the loop is sized in pixels, but that reasoning is
inverted — the painter it has to agree with is already using zoomed ones.

Every other curve shape scales, so this only bites self-loops.

**Fix taken:** hand `wireCurve` the zoomed positions. (The alternative — making
the loop's `spread` proportional to `scale` in `edgeCurve` — would have changed
how a loop looks in the graph view too, which is a separate decision.)

**Shown by** `Other/Both viewers` → `6. Self-loop dots`, which measures each
dot against `getPointAtLength(len / 2)` of the wire it stands for. Before the
fix, on that diagram: the two straight wires exact, the self-loop's dot at
`(0, -18)` — directly above the top of the loop, in empty canvas. After: all
three at `(0, 0)`.

Measured on `selfLoopSpiders`, where node 2 carries two parallel self-loops, the
offsets are 18.00, 14.06 and 18.48 — the last two mix this defect with
`spreadCoincident` deliberately sliding tied dots along their own wires, which
is why the story uses a single loop instead.

---

## Release-blocking API decisions

### 4. `show-labels="false"` now means labels *on*

- [x] **Done** this is fine we are pre-release

The default flip in `e4367fe` is a visible breaking change on its own. The sharp
edge: the **old README told people to write literally `show-labels="false"`** to
hide them, and Lit's `type: Boolean` converter is presence-based
(`value !== null`). So the users who followed the docs to turn labels off are
exactly the ones who now get them on.

**Fix:** release note calling this out by name, and a minor bump (0.3.0) rather
than a patch.

---

### 5. There is no public selection API

- [x] **Done** Not important right now

Shared selection is the headline of this release, but:

- `selection` is `@state() private` on `<zx-diagram>` — no property, no getter
- `selectionEvent` sets neither `bubbles` nor `composed`, so `zx-selection`
  never leaves the host
- neither `Selection` nor `SELECTION_EVENT` is exported from `src/index.ts`

A consumer can't read what is selected or drive it from outside. May be
deliberate for now — but the shape is much easier to settle before it ships than
after.

---

## Complexity / cleanups

### 6. `viewMode` changes force a full relayout

- [x] **Done** Fine for now

`src/zxDiagram.ts:130`. Every `viewMode` change drops all drags and the
selection — including between `both-vertical` and `both-horizontal`, which by
the design's own account differ *only* in `flex-direction`.

**Fix:** relayout only when `isBoth(viewMode)` changes.

---

### 7. `HypergraphDot.label` is dead

- [x] **Done.** Field and its one construction site deleted. `dot.src`/`dot.tgt`
      remain — they are what a selection is stated in — so the string is
      recoverable if anything ever wants it.

Built as `` `${wire.src}—${wire.tgt}` `` in `layoutHypergraph`
(`hypergraph/layout.ts:181`), declared in `hypergraph/types.ts:87`, read
nowhere — the viewer draws `dot.id`. `HypergraphScene` is internal, so nothing
outside can want it either.

---

### 8. Hulls are recomputed O(dots × blobs) times per render

- [ ] Done

`src/hypergraph/viewer.ts`:

- `#trespasses` calls `blobContains` for every dot/blob pair, and each call
  re-runs `orientedHull` (dedupe + sort + monotone chain) from scratch
- `blobOutline` then runs again per blob in `#renderBlob`
- and again per trespassing dot for the `<defs>` clip paths

All of it on every mousemove of a dot drag.

**Fix:** one `Map<blobId, Point[]>` of hulls computed at the top of `render()`,
threaded through `blobOutline` / `blobContains` / `#trespasses`.

---

### 9. `edgeColors` and `EDGE_KEY` are plain objects indexed by user strings

- [x] **Done.** `EDGE_KEY` is a `Map` — it is ours, so the safe structure is
      free — and `edgeColors` is read through `Object.hasOwn`, since its shape
      is the caller's and has to stay a plain object. `Graphs/Advanced` →
      `Custom wire kinds` now carries a `toString` wire: before the fix its
      `stroke` was the source text of `Object.prototype.toString`, an invalid
      colour the browser quietly ignores.

`src/colors.ts:115-141`. Now that `DiagramEdgeKind` is open,
`kind: 'toString'` returns the inherited function and `if (named) return named`
hands it back as the colour.

**Fix:** `Object.hasOwn` guard, or a `Map`. Marginal, but cheap.

---

### 10. Stale docs and small warts

- [ ] Done

- `docs/hypergraph-plan.md` still says dragging is "still open" and "the stories
  currently only render" — both shipped this release
- the CLAUDE.md Pauli-web gotcha, voided by item 2
- `<zx-diagram>.refresh()` calls `requestUpdate()` redundantly after
  `relayout()` has already set reactive state
- cosmetic: in a `both` mode with a `scalar`, `SCALAR_BOTTOM_MARGIN` is a fixed
  30px the graph layout doesn't scale while the hypergraph multiplies
  `scene.height` by `ZOOM` — the two canvases end up 18px different in height,
  and the hypergraph reserves a scalar strip it never draws in

---

### 11. Update hypergraph-plan

- [ ] Done

Chop out unnecessary context. Give short clear design decisions. Outline potential next steps

## Checked and fine

- Both `src/` folder rules hold mechanically: neither subfolder imports the
  other, and every root module is used by both subfolders (`types`, `curves`,
  `colors`, `selection`, `topology`) or by neither (`layout`, `attribution`,
  `zxDiagram`).
- Gesture teardown: both viewers unregister window listeners on
  `disconnectedCallback` and on adopting a new scene.
- `spreadCoincident` groups before it mutates, so a moved dot can't drag a later
  group with it.
