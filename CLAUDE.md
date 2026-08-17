# zxcc

Framework-agnostic `<zx-diagram>` web component for rendering ZX-calculus
diagrams. Built with Lit, no runtime dependencies. See README.md for
user-facing usage.

## Layout of `src/`

```
DiagramData  --layout()-->  Scene  --<zx-viewer>-->            SVG   (graph)
                            Scene  --layoutHypergraph()-->  HypergraphScene
                                   --<zx-hypergraph-viewer>-->  SVG   (hypergraph)
```

`src/` has two subfolders, `graph/` and `hypergraph/`, one per way of drawing
a diagram. **Two rules hold, and both are checkable:**

1. A file in a subfolder imports only from its own folder and from `src/`.
   Neither subfolder ever reaches into the other.
2. Everything in `src/` is imported by *both* subfolders or by *neither*. A
   module used by only one of them belongs inside that one.

Rule 2 is what put `layout()` above the split rather than in `graph/`: the
`Scene` it produces is the shared intermediate both views draw from, so
`<zx-diagram>` runs it once and hands the result to whichever painter is on.
`layoutHypergraph` therefore takes a `Scene` rather than laying the diagram
out a second time — that is what stops `hypergraph/` needing `graph/`.

**`src/` — shared, or nothing to do with either view**

- `types.ts` — both data contracts. `Diagram*` is the public input shape
  consumers hand to `<zx-diagram>`; `Scene*` is the laid-out, pixel-space
  result and is internal to the package.
- `layout.ts` — pure layout, producing that `Scene`. BFS from the inputs
  assigns col/qubit (skipped when the diagram arrives pre-positioned from the
  algebraic ZX walker), scales the grid to pixels, reserves the strip the
  scalar sits in, and annotates parallel edges with `index`/`parallel` so the
  viewer can fan them into arcs.
- `topology.ts` — the `Topology` class: adjacency, H-box chain tracing,
  pixel-clearance clamping, and the positions auto-placed H-boxes resolve to.
  Shared because the layout leaves H-boxes unplaced and both views need them
  somewhere.
- `curves.ts` — `Point`, the `Curve` union, and
  `edgeCurve`/`curvePath`/`curvePointAt`. `edgeCurve` is the single answer to
  where the wire between two points runs (straight, fanned arc, or self-loop);
  `linkPath` draws that curve and `wireCurve` hands the same one to the
  hypergraph layout, which parks a dot at t = 0.5 on it (and slides it along
  when two dots would land together), so the painted wire and the hypergraph's
  dot on it cannot disagree.
- `colors.ts` — the pyzx palettes, the scheme lookup, and which entry each
  kind of thing is painted with (`nodeColor`, `edgeColor`, `webColor`), plus
  `PHASE_FILL`, `LABEL_FILL` and `SELECTED_STROKE` — the blue both painters
  write a phase in, the grey they write an id label in, and the blue they
  outline a selection in. None is a palette entry, so none moves with
  `color-scheme`. Those
  lookups are here rather than in either painter so a spider and the blob
  standing for the same spider cannot come out different colours.
- `selection.ts` — `Selection`, what is picked out, and the `zx-selection`
  event a painter announces one with. A selection is held in the *diagram's*
  terms — ZX node ids and indices into `diagram.edges` — never in either
  painter's own, which is what lets the two views track each other: the same
  value means "spider 2" to one and "the blob standing for node 2" to the
  other, and neither painter has to know the other exists. Both painters are
  controlled: they own no selection, they announce the one a gesture makes and
  draw whatever `<zx-diagram>` hands back.
- `attribution.ts` — the "❤️ zxcc" badge drawn into the diagram's SVG.
- `zxDiagram.ts` — `<zx-diagram>`, the public element, and the only file that
  knows about both views.
- `index.ts` — package entry: `ZxDiagramElement`, the palettes, the input
  types, `toHypergraph`.

**`src/graph/` — the ZX diagram itself**

- `geometry.ts` — DOM-free path builders: `linkPath`, `webPath`, `boxBounds`,
  `groundSymbolPath`, plus `Rect` and the H-box drag arithmetic.
- `viewer.ts` — `<zx-viewer>`, the painter. Internal to the package.

**`src/hypergraph/` — the dual: wires become dots, spiders become blobs**

- `types.ts` — the dual's data contracts, `../types.ts`'s counterpart:
  `Hypergraph{Wire,Edge,Data}` for the conversion, `Hypergraph{Dot,Blob,Scene}`
  for the laid-out result.
- `convert.ts` — `toHypergraph`, turning a `DiagramData` into wires (one per
  ZX edge) and hyperedges (one per non-boundary ZX node). A hyperedge carries
  its `name` (`Z`) and `phase` (`π/2`) as separate fields, plus the joined
  `label` (`Z(π/2)`) for a caller that wants one string: `show-labels` drops
  the name and keeps the phase, and the viewer paints the phase in
  `<zx-viewer>`'s blue, so a phase reads the same in either view. That is the
  same split `layout()` makes between a node's id label and its `text`.
  `blobKind` is here too, and is the *only* place the hypergraph half looks at
  a `DiagramNodeType`: it maps a node to the shape its blob takes and rejects
  anything that hasn't got one, so a W, Z-box or `wire` node throws with a
  message naming it. Everything downstream reads the hyperedge's `kind` and so
  never has to consider a node type it can't draw.
- `geometry.ts` — `wireCurve` (the curve a wire's dot rides), `convexHull`/`blobPath`
  (the outline enclosing a set of dots), `blobContains` (the same shape as a
  hit test), and `blobOutline`/`blobLabelAnchor`/`blobCentre` over a live
  dot-position map.
- `layout.ts` — `layoutHypergraph`, parking each wire's dot at the midpoint of
  its edge so the two views line up, sliding it along that edge when two dots
  would land on one spot (`spreadCoincident`), then zooming the positions,
  since the dual has twice the marks at half the spacing.
- `viewer.ts` — `<zx-hypergraph-viewer>`, the second painter. Internal and
  light DOM. One piece of interaction state of its own, a plain field paired
  with an explicit `requestUpdate()` — the dragged dot positions — plus the
  `selection` the host hands it.
  A press on a dot selects and then drags it — every blob is derived from the
  dot positions on each render, so the blobs holding that wire reshape live,
  which is how the drawing is checked under strain, and selecting on the way in
  means the ones being reshaped are the ones picked out. A press anywhere else
  selects *every* blob whose outline contains the point, tested against the
  geometry (`blobContains`) rather than by asking the DOM what was hit, since
  the blobs overlap and SVG reports only the topmost. The two presses select by
  different tests on purpose: a press on canvas asks what is *here* (geometry),
  a press on a dot asks which hyperedges that wire is *part of* (membership,
  `blob.dots`). A dot often sits inside a blob that doesn't hold it — the hulls
  are crowded — and highlighting that blob would report an accident of the
  layout as a fact about the hypergraph. What the two presses *name* differs
  too, and that is what the diagram view reads: a press on canvas names the ZX
  nodes its blobs stand for, a press on a dot names the ZX edge, since the dot
  is that edge. The blobs holding a pressed dot are still outlined, but they are
  derived from the selected edge (`#picked`) rather than named by it — which is
  why pressing a dot lights up a wire over in the diagram and not the spiders at
  its ends. `#picked` is also where a *boundary* is answered: an input or output
  is no hyperedge and so has no blob, and the only thing standing for it here is
  the dot of the wire it hangs off, which is ringed on its own.
  `#picked` returns not just *what* is picked out but *how*: `named` for what
  the selection says outright — the blob for a selected node, the dot for a
  selected edge — and `implied` for what follows from it. Named is drawn solid
  and implied dashed, because one press reaches a whole neighbourhood (press a
  dot and you get the hyperedges holding that wire and every other wire in
  them) and in one weight the neighbourhood swallows the mark at the middle of
  it, which is the one you know is right. A boundary's dot is `implied`: the
  selection names the boundary, and the dot is the nearest thing this view has
  to it rather than the thing itself. The dash patterns differ between a blob's
  hull and a dot's ring, since one pattern across both reads as coarse on the
  small shape or as solid on the large one.
  Picked blobs paint last — the named one last of all — and take
  the same blue stroke `<zx-viewer>` uses, and each gets a dashed leader from
  its caption to the middle of the blob — a caption sits just off the top of
  its outline, which in a pile of overlapping blobs looks like it could belong
  to any of them. Leaders are their own layer above every blob, since inside a
  blob's group they would be painted over by whichever blobs came after.
  Every dot a selected blob holds is ringed in that same blue, derived from
  the selection on each render rather than stored: an outline says which shapes
  are picked out, but a hull is drawn round the dots it holds and will happily
  enclose ones it doesn't, so the outline alone can't say which wires are *in*
  it. That is also what makes pressing a dot answer "what shares a hyperedge
  with this wire" rather than just "which shapes hold it". The ring stands off
  the dot rather than restroking it, so it reads over every dot colour, the
  blue an H-wire's dot is filled with included.
  It takes the same `colors`
  palette
  `<zx-viewer>` does: a blob is filled with its node's own colour at 40%
  opacity and outlined in black, so overlapping blobs read as both colours,
  and a dot takes its edge's colour (an H-wire's dot is blue).
  A blob is the hull of *its own* dots, so it can swallow a dot belonging to
  another hyperedge — the drawing then claims a wire is part of something it
  isn't. Rather than bend the layout into never overlapping, the overlap is
  drawn: a red copy of the dot, clipped to a `<clipPath>` holding the outlines
  of every blob it has strayed into (a clip path is the union of its children,
  so several at once still work), so exactly the part that is somewhere it
  shouldn't be goes red and a dot half inside comes out half red. The marks
  live in their own layer in absolute coordinates, not in the dot's translated
  group, since a clip path resolves in the coordinate system of whatever
  references it; they carry `data-wire`, so pressing the red part still drags
  and selects the dot under it. A tally in that same red — `N trespassing
  nodes` — is centred across the strip between the bottom of the drawing and
  the bottom of the SVG, since each red mark is local and a dot half-buried
  under a neighbour's blob is easy to miss. Its count follows a drag but its
  position doesn't: the strip is measured from where the layout put the dots,
  not where they have been dragged to, so it reads as a caption on the drawing
  rather than another thing moving in it.

## The elements

`<zx-diagram>` runs `layout()` in `willUpdate()` into `@state` (`scene` /
`hypergraph` / `error`), then renders a painter per non-null state, each inside
its own scroll container — `<zx-viewer>` and/or `<zx-hypergraph-viewer>`.
`view-mode` picks which: `graph` (the default), `hypergraph`, or `both`, the
diagram stacked above its dual. `both` is the only mode that builds two, and it
is the one place `layout()` runs twice: the hypergraph is derived from the
scene at the diagram's own scale, and the graph is then laid out *again* at
`scale * ZOOM` — the hypergraph's zoom, exported from `hypergraph/layout.ts`
for exactly this. Every pixel position `layout()` produces is proportional to
`scale`, so that second layout brings the pair out the same width and puts each
dot on the midpoint of the wire drawn above it, at the same coordinates. The
alternative — scaling the painted SVG to fit — would have blown the 12px labels
up with it. A drag stays each view's own — pulling a dot about reshapes blobs
here and nothing there — but the **selection is shared**: `<zx-diagram>` holds
it (`@state selection`, cleared on every relayout), passes it to both painters,
and takes a new one from whichever painter announces `zx-selection`. That is the
whole of the linkage; the mapping between the two pictures is each painter's own
reading of the same node ids and edge indices, not a translation step in the
host. An unrecognised `view-mode` draws
the graph, the way an unrecognised `color-scheme` falls back to the original.
It owns the presentation properties that mirror
pyzx's `draw_d3` keyword arguments (`show-labels`, `color-scheme`, `scale`,
`colors`), resolves a scheme name to a palette, and passes the attribution
badge down as each painter's `overlay` — one per view, placed against that
view's own pixel bounds, since the badge is drawn inside the SVG so that it
travels with the picture and each of a stacked pair is copied on its own. It
carries the stylesheet for the whole
shadow tree, the painters' SVG included.

Both painters render into the **light DOM** (`createRenderRoot() { return
this }`). It is an internal part of `<zx-diagram>`: sharing the host's
stylesheet keeps the SVG reachable from `zx-diagram.shadowRoot` (which every
story's play function relies on) and avoids a second shadow boundary. It is
deliberately not exported — promoting it later (own shadow root + export) is
non-breaking; demoting it would not be.

The viewer stores exactly three pieces of interaction state — dragged
positions, H-box line parameters, and the live brush rect — plus the
`selection` the host owns, and derives everything else (H-box positions, box
bounds, edge paths) in `render()`. There is no imperative "sync the DOM to the
model" pass; a drag mutates state and calls `requestUpdate()`. Those three are
plain private fields rather than `@state()` precisely because they are mutated
in place and paired with an explicit `requestUpdate()`. A gesture that changes
the selection instead dispatches `zx-selection` and waits for the host to hand
one back; a node drag moves the set the press itself *makes*, since that
round-trip only lands on the next update. A selected ZX edge is drawn but never
selected in this view — nothing here is an edge to point at, so it only ever
arrives from a press on a dot in the other view. It is **cased** rather than
recoloured: the same path painted underneath in the selection blue, wide enough
to show either side of the wire. An edge's colour is what it *is* — an H-edge is
`Hedge`, `#0088ff` in the original palette, which taking `#00f` over the top
would be all but indistinguishable from — so the blue goes round it, the same
move a node's blue outline and a dot's blue ring make. And it *stands off* the
wire, again as the dot's ring does: a band of `CANVAS_FILL` between the two,
which is what makes the blue read as a surround rather than as a thicker wire,
and is what the light-blue-inside-dark-blue H-edge needs. `CANVAS_FILL` is in
`colors.ts` because `<zx-diagram>` paints the SVG background with it too, and a
band in any other colour would be a stripe rather than a gap. The casings are
their own layer under *every* wire rather than under their own: inside `g.link`
a casing would be painted over by whichever edges come after it and would cover
the ones crossing it. Every blue is painted before every gap, so two selected
edges crossing don't knock holes in each other.

Because a painter updates on its own cycle, anything that needs the SVG in the
DOM has to await it: `<zx-diagram>` overrides `getUpdateComplete()` and awaits
every mounted child before measuring the attributions. A measuring pass only
counts as done once *every* badge has been placed — one view can be measurable
while the other is not yet.

`<zx-hypergraph-viewer>` keeps one, the same way — the dragged dot positions —
and derives every blob outline, dot ring and trespass mark from that and the
host's selection in `render()`.

## Build

- `tsc` compiles `src/**/*.ts` to `dist/*.js` + `.d.ts`.
- Rollup then bundles `dist/index.js` → `dist/index.bundle.js`, inlining lit
  so the shipped bundle has zero runtime deps.
- Package entry is `dist/index.bundle.js`; `dist/index.js` is the tsc
  intermediate (also shipped, but nothing imports it in practice).
- `context: 'globalThis'` in rollup config is required so tsc's emitted
  `__decorate` helper (used by Lit's `@customElement` etc.) doesn't get
  rewritten to `undefined && ...`.
- `__ZXCC_VERSION__` (used by the attribution link) is injected by
  `@rollup/plugin-replace` and, for Storybook, by vite `define` in
  `.storybook/main.ts`. Declared in `src/globals.d.ts`.

## Committing

Sometimes this repository is managed with GitButler.
Check whether you are on the `gitbutler/workspace` branch; if so, use the `but` CLI to interact with it.
Make changes in new commits, as opposed to modifying existing commits, unless explicitly told to.

**Do not add attributions to yourself in commit messages**

## Conventions

- Lit decorators are on: `experimentalDecorators: true` and
  `useDefineForClassFields: false` in tsconfig. Use `@customElement`,
  `@property`, `@state`.
- `diagram`, `scene`, `colors` and `selection` are `{ attribute: false }`
  properties, not HTML attributes — they carry arbitrary objects.
- Templates use the `svg` tag for anything nested inside `<svg>`; only the
  root `<svg>` sits in an `html` template.
- **No whitespace between the children of an SVG `<text>`.** A newline in the
  template renders as a space, which widens the attribution badge and
  off-centres the scalar.
- Event listeners on the node/brush layers are delegated and bound as
  arrow-function class fields, so their identity is stable across renders and
  Lit doesn't rebind them.
- `<zx-diagram>` deliberately renders a single diagram. Layout of multiple
  panels (current vs. goal, side-by-side/stacked/hidden) lives in downstream
  consumers, not here.

## Testing

- Storybook interaction tests, run through `vitest` in **browser mode**
  (Playwright/chromium) via `@storybook/addon-vitest`. There are no unit
  tests and no jsdom — `npm run test` runs the stories' `play` functions.
  Chromatic snapshots the same stories on push.
- The play functions assert on rendered SVG attributes, so the DOM is a
  contract: `g.node` wrapping per-node `<g data-node>`, `g.brush >
  rect.overlay`, `path.selectable` for the ground symbol, `text[fill="#999"]`
  for id labels, the scalar as the only direct `<text>` child of the `<svg>`,
  a selected node marked by `#00f` in its shape's `style` and a selected edge
  by its casing — `g.casing > path[data-link]`, carrying the edge's index, with
  the wire in `g.link` left untouched — and `g.attribution` carrying a `rect`
  chip. In `both` mode the
  two views share one tree, so anything ambiguous is scoped by painter tag
  (`zx-viewer …` / `zx-hypergraph-viewer …`). The hypergraph view has its own:
  `g.blob` wrapping per-hyperedge `<g data-hyperedge>`, `g.dot` wrapping
  per-wire `<g data-wire>`, a selected blob marked by `#00f` in its path's
  `style` and its leader as `line.leader[data-hyperedge]`, a picked dot
  carrying a `circle.selected` ring inside its `<g data-wire>`, an
  *implied* (dashed) blob or ring carrying `.implied` alongside — so
  `path:not(.implied)` and `circle.selected:not(.implied)` are what the
  selection named,
  a blob's caption
  split into `<tspan>`s with the phase carrying `fill="#00d"`, and a dot
  overlapping a blob that doesn't hold it as `g.overlap circle[data-wire]`
  with its `clipPath` id ending `-<wire id>`, and the trespass tally as
  `text.tally`. Shared
  query/gesture helpers live in
  `stories/interactionHelpers.ts`.
- Stories live outside `src/` so they don't get emitted by the library `tsc`
  build; `tsconfig.stories.json` type-checks them (wired into `npm run lint`).
  `.storybook/preview.ts` imports `src/index` so the element registers before
  any story renders.
- `stories/` mirrors the `src/` split: `stories/graphs/` and
  `stories/hypergraphs/`, titled `Graphs/…` and `Hypergraphs/…` so Storybook
  groups them, with the shared `diagrams.ts`/`interactionHelpers.ts` and the
  `Playground` story (the only ungrouped one) at the top level. The sidebar
  order is pinned by `storySort` in `.storybook/preview.ts`.

## Gotchas

- The gap in a selected edge's casing is an opaque band, so it knocks out
  whatever is painted under that stretch of wire. In practice that means a
  **Pauli-web strand disappears under a selected edge** — the strands run along
  the edges and are wider than the casing. Painting the casings below the webs
  instead would bury the highlight rather than the strand, and a translucent
  band doesn't rescue it (the strands are pale enough that 20% of one is
  invisible). Skipping the gap on edges that carry a strand is the fix if it
  starts to matter.
- `phase` strings are pre-formatted (`π/2`, `-π/4`, `0`) — no parsing in
  `layout.ts`. Consumers do their own formatting.
- Default H-box phase is `π`, which renders no text (pyzx convention).
- `labels` overrides are folded into `SceneNode.text` during layout — the
  viewer never sees the override map.
- Boxes are sorted largest-nodeIds-first so outer paint behind inner.
- H-box positioning depends on `scene.autoHbox`: false when the diagram
  arrived pre-positioned, otherwise their supplied coordinates get overwritten
  on every paint. Auto-placed H-boxes also drag differently — they slide along
  their chain line (a line parameter) rather than moving freely, clamped by a
  pixel clearance derived from the painted shapes.
- Barycentre-parked H-boxes are spread as a group, in one pass, rather than
  nudged one at a time: an iterative nudge settles exactly on its own
  threshold and the box visibly flicks sideways as the diagram is dragged.
- Hypergraph dots that land on top of each other — two crossing edges share a
  midpoint — are spread as a group in one pass for the same reason
  (`spreadCoincident`), but each dot slides along *its own wire* rather than
  down the column. The column is the one direction that is already full:
  consecutive midpoints sit half a ZX scale apart on it, so a group of three or
  more spread that way reaches into its neighbours' slots and lands on their
  dots — measured on the n-to-m story, spreading down the column re-creates the
  very collision it removes, from 4-by-4 up. Each wire runs its own way, so
  sliding opens the group out across the gap between the ranks, which is empty,
  and a slid dot is still on the wire it stands for (`wireCurve`, the curve
  `<zx-viewer>` paints). Sitting at the exact midpoint is not worth preserving:
  two wires can share that point, and then it says nothing.
- The spread groups dots by proximity rather than by exact ties, and its step is
  measured in dot radii (`TIE_GAP`), not in fractions of the grid: the question
  is whether you can see that there are two of them. A diagram that arrives
  pre-positioned from the algebraic walker is on no grid at all, so exact ties
  are not the only way two dots become one blot.
- Spreading dots does *not* reduce the trespass tally, and isn't meant to. Every
  trespass at rest is a coincidence — measured, the whole tally — and separating
  the dots converts each one into a dot sitting inside a neighbouring hull
  instead. Clearing those needs every crowded dot moved half a scale or more,
  which is a different problem from two dots drawn on one spot.
