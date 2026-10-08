# zxcc

Framework-agnostic `<zx-diagram>` web component for rendering ZX-calculus
diagrams. Built with Lit, no runtime dependencies. See README.md for
user-facing usage.

## Committing

Sometimes this repository is managed with GitButler.
Check whether you are on the `gitbutler/workspace` branch; if so, use the `but` CLI to interact with it.
Make changes in new commits, as opposed to modifying existing commits, unless explicitly told to.

**Do not add attributions to yourself in commit messages**

## Writing style

When writing comments, or user facing text, write from the context of someone coming into the context cold.
Don't write as though someone has heard the conversation.
People don't need to know that something hasn't happened.

If that sort of design decision context is important, put it in CLAUDE.md

## Layout of `src/`

```
DiagramData  --layout()-->  Scene  --<zx-viewer>-->  SVG  (graph)

                            Scene  --layoutHypergraph()-->  HypergraphInput
        HypergraphInput  --hypergraphScene()-->  HypergraphScene
                                   --<zx-hypergraph-viewer>-->  SVG  (hypergraph)
```

A `HypergraphInput` is the hypergraph *and where to draw it*, and there are two
ways to one. A caller writes one out, putting every dot in a column/qubit grid
square. `layoutHypergraph` derives one from a diagram and its `Scene`, in
pixels, having taken every dot's position from the midpoint of the wire it
stands for. Both then go through `hypergraphScene`, which checks the input and
measures it — which is why the two share a painter, and also why `<zx-diagram>`
can mount a `<zx-hypergraph>` for its dual rather than a painter directly.

The split is at *positioning*, not at "who lays out": everything about where the
dual goes is decided in `layoutHypergraph`, and `hypergraphScene` decides only
the weights and, for a grid input, the spacing.

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
  result and is internal to the package. `DiagramNodeType` is closed — a node
  type has a shape, and the package either draws it or doesn't —
  but `DiagramEdgeKind` is open (`… | (string & {})`): an edge's kind is only
  ever a colour, so a diagram can invent kinds and name them in `edgeColors`.
  The literals stay in the union for autocomplete.
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
- `colors.ts` — which palette entry each kind of thing is painted with
  (`nodeColor`, `edgeColor`, `webColor`). The values
  themselves, palettes and fixed colours alike, are in `constants.ts`; this
  file is the lookups, and they are here rather than in either painter so a
  spider and the blob standing for the same spider cannot come out different
  colours.
  `edgeColor` takes a third argument, `<zx-diagram>`'s `edgeColors` map, and
  tries it *before* the palette: `edgeColors[kind]`, then `EDGE_KEY[kind]`'s
  palette entry for one of the three built-in kinds, then `colors.edge`. That
  order is what makes `DiagramEdgeKind` open — any string is a kind, a kind is
  only ever a colour (nothing in the layout or the geometry reads one), and a
  kind nobody has given a colour draws like a plain wire rather than coming out
  undefined. The overrides ride alongside the palette rather than being folded
  into it because a kind of your own has no pyzx entry to fold into; both
  painters call this one function, which is what stops a wire and the dot
  standing for it disagreeing.
- `constants.ts` — every colour value the package paints with, plus the plain
  data behind the presentation properties: `VIEW_MODES`/`ViewMode`, and the
  three palettes plus `COLOR_SCHEMES`. The
  palettes are pyzx's with one key added, `Idark`, the identity Pauli-web
  strand: pyzx has no such strand, and it is the same grey in all three schemes
  since an identity strand is the one that names no basis. It lives in the
  palettes rather than among the fixed colours below so that every strand a web
  can carry is looked up the same way. Those fixed colours are the five that
  belong to no palette and so stay put under every scheme: `PHASE_FILL`,
  `LABEL_FILL`, `SELECTED_STROKE`, `CANVAS_FILL` and `VDATA_FILL` — the blue
  both painters write a phase in, the grey they write an id label in, the blue
  they outline a selection in, the near-white the SVG background takes, and the
  red a node's vdata is annotated in. This is every colour's
  single home; everything that needs one imports from here, and `index.ts`
  re-exports the view modes and the palettes, the public half — the fixed
  colours are internal and stay unexported. It is also
  published as a *second entry point*, `@adnathanail/zxcc/constants`, for
  build-time tooling that validates an option value in Node. The main entry
  can't serve that — the bundle calls `customElements.define` at module scope.
  `dist/constants.js` is a bundle of its own (the second `pack` build in
  `vite.config.ts`), so an import here would be inlined rather than break Node
  resolution; what has to hold is that nothing reachable from this file touches
  the DOM. So only data lives here — `isViewMode` and the colour *lookups* stay
  in `zxDiagram.ts` and `colors.ts`, since they are code the browser half calls.
- `selection.ts` — `Selection`, what is picked out, and the `zx-selection`
  event a painter announces one with, and every host re-announces. A selection is held in the *diagram's*
  terms — ZX node ids and indices into `diagram.edges` — never in either
  painter's own, which is what lets the two views track each other: the same
  value means "spider 2" to one and "the blob standing for node 2" to the
  other, and neither painter has to know the other exists. Both painters are
  controlled: they own no selection, they announce the one a gesture makes and
  draw whatever `<zx-diagram>` hands back.
- `attribution.ts` — the "❤️ zxcc" badge drawn into the diagram's SVG.
- `gestures.ts` — `trackPointer`, the window-level `pointermove`/`pointerup`/
  `pointercancel` plumbing a drag runs on, plus the non-passive `touchmove`
  block that keeps a drag from turning into a pan. Both painters run every
  gesture through it, which is what keeps the two-finger and cancel behaviour
  described under *Conventions* the same in either view.
- `viewerHost.ts` — `ZxViewerHost`, what a public element does *around* a
  painter: the presentation properties, the palette a scheme name resolves to,
  the error state, the selection, the attribution badge's measuring pass, and
  the stylesheet the light-DOM painters are styled by. All three public elements
  extend it and add only what belongs to their own input. It is in `src/`
  rather than in either subfolder because neither subfolder imports it — the
  elements do, and all of those are here as well.
  `relayout()` is concrete and lives here alone: it clears, drops the
  selection, builds, and turns a throw into the error state, in that order. A
  subclass says only *what* to clear and *what* to build, so the reset ordering
  and the error handling cannot drift between the three.
  `selection` is a `@property` rather than private state, and `onSelection`
  stores what a child announced and then announces it again as this element's
  own. Both are for the sake of nesting: `<zx-diagram>` writes the selection
  onto its two children and hears their gestures back, which is the whole of
  the linkage, and the re-dispatch makes `zx-selection` an event a consumer can
  listen for on whichever element they put in the page.
- `zxGraph.ts` — `<zx-graph>`, the public element for a ZX diagram drawn as
  itself. `layout()` into `<zx-viewer>`, and nothing else; it does not know the
  dual exists.
- `zxHypergraph.ts` — `<zx-hypergraph>`, the public element for a hypergraph.
  `hypergraphScene()` into `<zx-hypergraph-viewer>`, and nothing else. It sits
  beside the others rather than inside `hypergraph/` for the same reason
  `layout()` is above the split: an element is the layer over the painters, not
  one of them, and putting it in the subfolder would leave `src/viewerHost.ts`
  imported by one subfolder only.
- `zxDiagram.ts` — `<zx-diagram>`, the element that takes a ZX diagram and
  mounts the other two, and the only file that knows about both views.
- `index.ts` — package entry: the three elements, the palettes, and the input
  types. `toHypergraph` is *not* exported: the dual is a way of drawing a
  diagram, not a data structure the package hands out, and keeping it internal
  is what lets it take a `Scene` (see `hypergraph/convert.ts`).

**`src/graph/` — the ZX diagram itself**

- `geometry.ts` — DOM-free path builders: `linkPath`, `webPath`, `boxBounds`,
  `groundSymbolPath`, plus `Rect` and the H-box drag arithmetic.
- `viewer.ts` — `<zx-viewer>`, the painter. Internal to the package.

**`src/hypergraph/` — the dual: wires become dots, spiders become blobs**

- `types.ts` — the dual's data contracts, `../types.ts`'s counterpart:
  `HypergraphInput{,Wire,Hyperedge}` for the hypergraph *and where to draw it*,
  `Hypergraph{Wire,Edge,Data}` for the conversion, `Hypergraph{Dot,Blob,Scene}`
  for the laid-out result. The first is public input the way `Diagram*` is; the
  other two are the package's own.
  `HypergraphInputWire` is a union of a grid wire (`col`/`qubit`) and a pixel
  one (`x`/`y`), each declaring the other pair `never` so the exclusivity holds
  at compile time as well as being checked at runtime. A wire and a hyperedge
  each carry an optional numeric `id`, which is *what a selection names it by* —
  a ZX edge index and a ZX node id for a derived input, and the position in the
  list when the caller says nothing. Defaulting to the position is what makes
  the ids backwards-compatible and what makes a derived input state the
  diagram's own terms without a translation step anywhere.
  `HypergraphInputBoundary` is the third list, `boundaries` — the inputs and
  outputs that are *not* drawn as blobs, each naming its id and the wire hanging
  off it. Nothing is painted for one, so `hyperedges` stays exactly "what is
  drawn as a blob"; what a boundary buys is that the leg is still held at both
  ends. A dot answers a selection with what is at its ends rather than with the
  blobs around it, so that leg is still ringed when its input is selected in the
  diagram view, and an identity wire — whose two ends are both boundaries — is a
  wire held at all rather than one held by nothing. Its id is said outright
  rather than taken from its position, since a position in `boundaries` is not a
  position in `hyperedges` and the two lists share one pool of ids.
- `convert.ts` — `toHypergraph`, turning a `DiagramData`, and the `Scene` it
  laid out to, into wires (one per ZX edge) and hyperedges (one per ZX node,
  boundaries included). A hyperedge carries
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

  The `Scene` is there for the phase and nothing else. Which string a node's
  phase *draws* is a set of conventions — a spider's `0` and an H-box's default
  `π` draw nothing, a `labels` entry replaces whatever the phase said — and
  `SceneNode.text` is the answer with all of them applied. Reading it is what
  keeps a blob's caption and the phase under the node it stands for from
  drifting apart; deriving it a second time from `DiagramNode.phase` meant
  stating every convention twice, in two folders, and the H-box rule was
  already living in both. The conversion is combinatorics either way — it takes
  no *coordinates* from the scene, and `layoutHypergraph` already had one to
  hand.

  A boundary is a hyperedge holding one wire, so its blob is the hull of a
  single dot — a circle around it. That is what tells a boundary leg apart from
  a self-loop in the dual: both are one dot hanging off one spider, and without
  a boundary blob both come out as a dot held by exactly one blob. With it, the
  count reads directly off the drawing — every dot is in two blobs, one per end
  of its wire, and a self-loop is the only dot in one, since its two ends are
  the same node. An identity wire (input straight to output) is in two as well.
  `Hypergraphs/Interactions` → `4. Boundary legs and self-loops` holds that
  count, by pressing each dot and reading back the blobs the press reached —
  which blobs hold a wire is membership, and a press is how the drawing answers
  it. `<zx-diagram disable-io-blobs-in-hypergraph>` drops them, for a
  diagram whose boundaries are many enough that a circle round every leg is
  more outline than information; that count is what it costs, which is why they
  are on by default. It is answered in `layout.ts`, by moving the boundary
  hyperedges out of the input's `hyperedges` and into its `boundaries`, which is
  what leaves those legs with a blob at one end only. The boundary is still
  named, so a boundary selected over in the diagram rings its leg's dot here
  with nothing drawn round it.
- `geometry.ts` — `wireCurve` (the curve a wire's dot rides), `blobHull` (the
  convex hull of a blob's dots), `hullPath` (the outline standing off that hull)
  and `hullContains` (the same shape as a hit test), plus
  `blobLabelAnchor`/`blobCentre` over a live dot-position map.

  What a function takes says what it depends on: `hull*` takes a hull, `blob*`
  takes the blob and the positions. The hull is the split point because it is
  the expensive step — a sort and a monotone chain — and every question about a
  blob is answered from it, so `<zx-hypergraph-viewer>` computes one per blob
  per render and passes it down. The trespass test asks every dot about every
  blob, so deriving the hull inside it would be a sort per pair: on the 4-by-5
  n-to-m story that is 18 hulls a render rather than 540.
  Its `boundaryBlobs` option (see `layout.ts`) is the one thing that can be left
  out of the drawing, and it is applied when the blobs are built rather than
  when they are painted — a blob missing from the `HypergraphScene` cannot be
  pressed inside, cannot ring the dot it holds, and cannot have a neighbouring
  dot counted as trespassing into it. Skipping it in the viewer would have left
  all three answering about a shape that is not on screen.
- `layout.ts` — `layoutHypergraph`, which produces a pixel-positioned
  `HypergraphInput` carrying its own canvas rather than a scene. Stopping at the
  input is what lets `<zx-diagram>` mount a `<zx-hypergraph>`: what comes out of
  here is the same thing a caller could have written by hand, and goes through
  the same builder and the same checks. It zooms the resolved node positions by
  `ZOOM` first — the dual has twice the marks at half the spacing, so it is
  drawn roomier — then builds each wire's curve from those and parks the dot at
  its midpoint, sliding it along the curve when two dots would land on one spot
  (`spreadCoincident`).

  The zoom comes before the curves rather than after the midpoints for the sake
  of one curve: a self-loop's arc is a fixed number of pixels above its node,
  not a fraction of anything, so scaling a loop drawn at `p` does not give the
  loop drawn at `p * ZOOM`. Evaluating first and zooming after put a self-loop's
  dot 18px clear of the loop `<zx-viewer>` paints. Every other curve shape is
  homogeneous in its endpoints and comes out identical either way, which is why
  the bug was confined to loops. Nothing asserts this: to check it by hand, draw
  a diagram carrying a self-loop in a `both` mode and compare the dot's
  `translate` against `getPointAtLength(len / 2)` of the wire's path.
- `scene.ts` — `hypergraphScene`, the one way to a `HypergraphScene` and where
  every input is checked. It takes the dots wherever the input put them —
  grid squares scaled to pixels, or pixels used verbatim — and measures the
  weights and, unless the input gave one, a canvas.

  The grid is the same column/qubit grid `layout()` puts a diagram on, rather
  than pixels, which is what makes `scale` mean the same thing on this side as
  on the other: the whole drawing grows with it, rather than the marks growing
  on a canvas that stays put. The grid is read relative to its own lowest column
  and qubit, so negative and fractional coordinates are positions like any
  other. A square is `GRID_STEP` scales rather than one, because every mark in
  the dual carries a blob's outline standing `blobRadius` off it and two dots a
  single scale apart come out with their blobs all but touching — the same
  problem `ZOOM` answers for a derived scene, where the spacing is spread and
  the blobs are left alone.

  A pixel-positioned input has had all of that decided for it already, so
  nothing is subtracted and nothing is added: those coordinates *are* where the
  dots go, and `scale` sets the weights alone. That is the wart in the property,
  and it is the price of one builder — raising `scale` on a pixel input grows
  the dots without moving them. A derived input is always in that form, because
  its whole point is being pinned to the diagram it came from, and a canvas
  measured around its dots would be whatever size they happened to need rather
  than the ZX layout's own zoomed.

  It shares `layout.ts`'s `sceneMetrics`, so a hand-written drawing comes out at
  the same dot and blob weights as a derived one at the same scale. A measured
  canvas reserves the strip at the bottom that a derived one inherits from the
  scalar's — a hand-written hypergraph has no scalar, and the trespass tally is
  written there. Its padding is one scale a side, as `layout()` leaves, but
  floored at what is drawn outside the dots themselves: a blob's standoff, plus
  the caption above it and the wire id below. Those two are a font size rather
  than a fraction of the grid, so at a small scale they are the larger of the
  pair — a derived scene gets the room free from the ZX layout's deeper padding.

  The rules it enforces are three. Every wire is positioned one way or the
  other, never both and never neither, and all of them the same way: the two are
  measured from different origins, so a mixed input has no single drawing, and
  half a coordinate would silently become the top-left. Every id is distinct,
  since an id is what a selection names a mark by, and the `boundaries` share
  that one pool with the hyperedges. And every wire is held by one or two ends,
  counting a boundary as an end: nothing is drawn for one, but a
  `HypergraphDot`'s `src` and `tgt` are what is at its ends rather than what is
  drawn around it, so a named boundary is an end the dot can answer a press
  with. Two is the ordinary case; three has no meaning, because those two fields
  *are* the ends — it is how a press on a dot answers in the diagram's terms —
  so a wire held by three has no answer to give. One is what is left when
  whatever is at the wire's other end is neither drawn nor named, which is a
  hand-written input's way of saying the same thing
  `<zx-diagram disable-io-blobs-in-hypergraph>` says with its `boundaries`. Such
  a wire carries its one end in both `src` and `tgt`, which is what a
  self-loop's looks like too — nothing downstream tells those two apart, and
  what does is the drawing, and only when the boundary blobs are on. A
  hypergraph in general has none of these rules; this package draws the duals of
  ZX diagrams, and that is the difference written down.
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
  its ends.
  `#picked` returns not just *what* is picked out but *how*: `named` for what
  the selection says outright — the blob for a selected node, the dot for a
  selected edge — and `implied` for what follows from it. Named is drawn solid
  and implied dashed, since a press reaches things it didn't point at and in
  one weight they read as equally certain. `#picked` has no case for boundaries:
  a boundary is a hyperedge like any other, so selecting one names its blob and
  implies its one dot, exactly as selecting a spider does. With the boundary
  blobs dropped there is no blob to name and the dot is implied on its own,
  since a dot knows what is at its ends whether or not both are drawn. The
  dash patterns differ between a blob's hull and a dot's ring, since one pattern
  across both reads as coarse on the small shape or as solid on the large one.
  How far a press reaches is deliberately short. A press on a dot marks the dot
  and the blobs holding it, and stops: the other wires *those* blobs hold are a
  step further out again, and one dot pressed lighting up five is more than was
  asked — it buries the dot in its own answer. So the only dots ever ringed are
  the ones incident to a *named* ZX node, plus the named dot itself.
  Picked blobs paint last — the named one last of all — and take
  the same blue stroke `<zx-viewer>` uses, and each gets a dashed leader from
  its caption to the middle of the blob — a caption sits just off the top of
  its outline, which in a pile of overlapping blobs looks like it could belong
  to any of them. Leaders are their own layer above every blob, since inside a
  blob's group they would be painted over by whichever blobs came after.
  Every dot a *named* blob holds is ringed in that same blue, derived from
  the selection on each render rather than stored: an outline says which shapes
  are picked out, but a hull is drawn round the dots it holds and will happily
  enclose ones it doesn't, so the outline alone can't say which wires are *in*
  it. Selecting a spider therefore states its arity in the dual directly. The
  ring stands off
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

There are three public elements. `<zx-graph>` draws a ZX diagram, and
`<zx-hypergraph>` draws a hypergraph; each takes one input, builds one thing,
and mounts one painter. `<zx-diagram>` takes a ZX diagram and mounts one or both
of the others.

What all three share is `ZxViewerHost` (`viewerHost.ts`) — the presentation
properties, the palette, the error state and its Retry, the selection, the
attribution measuring pass, and the stylesheet the light-DOM painters need — and
what they add is the part that belongs to their own input. A host is defined by
three things: `painted`, the views it has and the painter tag for each, and
`clear()`/`build()`, how it discards and rebuilds them. `relayout()` is the
base's own, and calls those two.

`<zx-graph>` runs `layout()` in `willUpdate()` into one `@state` scene and
renders `<zx-viewer>` inside its scroll container. `<zx-hypergraph>` is the same
shape with `hypergraphScene(hypergraph, scale)` and
`<zx-hypergraph-viewer>`; its `scale` defaults to 35, the middle of the 20–50
band `layout()` clamps a derived scale to, because a hand-written hypergraph has
no diagram extent to derive one from.

`<zx-diagram>` builds nothing to paint itself — its `painted` is empty and it
mounts no painter. What it does instead is the part neither of the others can:
derive the one picture from the other. `view-mode` picks which it mounts:
`graph` (the default), `hypergraph`, or both — the diagram above its dual
(`both-vertical`) or to the left of it (`both-horizontal`). The two `both` modes
differ in one thing only, the `flex-direction` of the box holding the pair;
everything laid out or painted is the same, which is why `build()` asks only
whether the mode is *not* `graph` (build the dual) and *not* `hypergraph`
(build the graph), and the mode itself is read only in `render()`. Side by side
the pair splits the width evenly (`flex: 1 1 0`) rather than sizing to the
drawings, so a wide picture scrolls in its half instead of
crowding the other out — the rule is on the child *elements*, each of which
brings its own scroll container.

A `both` mode is the only one that mounts two views, and is the one place
`layout()` runs twice: `<zx-diagram>` runs it once at the diagram's own scale to
derive the hypergraph from, and the `<zx-graph>` it mounts runs it again at
`scale * ZOOM` — the hypergraph's zoom, exported from `hypergraph/layout.ts` for
exactly this. Every pixel position `layout()` produces is proportional to
`scale`, so that second layout brings the pair out the same size and puts each
dot on the same coordinates as the midpoint of the wire it stands for — under
that wire when the pair is stacked, level with it when it is side by side. The
alternative — scaling the painted SVG to fit — would have blown the 12px labels
up with it. In `graph` mode `<zx-diagram>` runs no layout at all; the child does
the one that is needed. So the count is the same as it ever was: one in `graph`,
one in `hypergraph`, two in `both`.

The one thing `layout()` produces that is *not* proportional to `scale` is the
strip it reserves under the drawing for the scalar, which is a fixed number of
pixels. `Scene.diagramHeight` is the height without it, and is what
`layoutHypergraph` zooms; the strip is carried across as it stands, since a
distance in pixels is the same distance at any zoom. Zooming the whole `height`
instead made the dual 18px taller than the graph whenever a diagram carried a
scalar. The dual paints no scalar and keeps the strip regardless — the pair
being the same size is the point of the mode, and the trespass tally is written
in that strip.

A drag stays each view's own — pulling a dot about reshapes blobs here and
nothing there — but the **selection is shared**: `<zx-diagram>` holds it
(cleared on every relayout), writes it onto both children, and takes a new one
from whichever child announces `zx-selection`. A host stores what its painter
announced and announces it again as its own, which is what carries a gesture up
through the nesting — and also makes `zx-selection` an event a consumer can
listen for on whichever element they put in the page. That is the whole of the
linkage; the mapping between the two pictures is each painter's own reading of
the same node ids and edge indices, not a translation step in any host.

**Errors are reported by whichever element worked the thing out.** An
unrecognised `view-mode`, a diagram the dual can't be built from, and the
derivation itself are `<zx-diagram>`'s; the diagram's own layout belongs to the
`<zx-graph>` it mounts, and a hypergraph input that doesn't check out belongs to
the `<zx-hypergraph>`. Either way it is the same grey `<pre>` and Retry in the
same place on the page, which is the point of the three sharing a host, and in a
`both` mode it says which of the pair failed. An unrecognised `view-mode` is an
error at all — unlike an unrecognised `color-scheme`, which falls back to the
original. The asymmetry is deliberate: a scheme has an obvious thing to fall
back *to* and the picture is still the right picture in the wrong colours,
whereas picking one of four modes on the author's behalf means guessing which
drawing they meant, and a typo that quietly drew something else is only found by
noticing the picture is wrong. `VIEW_MODES` is the array both the check and the
`ViewMode` type derive from, so the two cannot drift.

A `scale` that isn't a positive number is an error on all three elements for
the same reason. The attribute converter turns a value that doesn't parse into
`NaN`, and drawing at the derived or default scale instead would make a typo
look like a choice. A *missing* scale is not an error: that is what asks for the
derived one (or, on `<zx-hypergraph>`, the default). The check is
`ZxViewerHost.givenScale`, called first thing in each element's `build()`, so
`<zx-diagram>` refuses before mounting either view and `layout()` and
`hypergraphScene()` can take the number they are handed verbatim.

`<zx-diagram>` owns the presentation properties that mirror pyzx's `draw_d3`
keyword arguments (`show-labels`, `color-scheme`, `scale`, `colors`) plus
`edgeColors` and `disable-io-blobs-in-hypergraph`, which have no pyzx
counterpart, and passes them down — the palette already resolved, so a scheme is
looked up once by the element it was set on. That last property is named for
what it turns *off*, against the grain of every other property here, because
Lit's `Boolean` converter reads a present attribute as true and an absent one as
false: a default-on `show-…` would have no way to say "off" in markup and would
need a converter of its own, where a default-off `disable-…` is a bare
attribute. The layout option behind it stays positive (`boundaryBlobs`), so the
negation happens once, at the point the two meet. Changing it relayouts, since
the flag is answered when the input is emitted. It has no counterpart on
`<zx-hypergraph>`, and a hand-written hypergraph says the same thing by simply
leaving the boundary hyperedges out — which is legitimate now that a wire may be
held by a single end.

`refresh()` on `<zx-diagram>` calls the children's. The dual gets a freshly
derived input and would relayout on its own, but `<zx-graph>` is handed the very
`diagram` object that was mutated in place, so nothing about it has changed
identity and only being asked will do.

`<zx-diagram>`'s dual is pinned to the diagram it came from — a dot on the
midpoint of its wire — which is what makes a `both` mode line up and is also the
only arrangement it will produce. Writing a `HypergraphInput` by hand gives that
up in exchange for saying where every dot goes. Which is why the derived route
still exists at all: it is not a worse way of writing one out, it is the only
thing that produces the pinning.

Because a painter updates on its own cycle, anything that needs the SVG in the
DOM has to await it: a host overrides `getUpdateComplete()` and awaits every
mounted child — painters, and the two hosts `<zx-diagram>` mounts, which await
their own painters in turn. A measuring pass only counts as done once *every*
badge has been placed. `<zx-diagram>` places none: each element carries its own
picture and measures its own badge against it.

Both painters render into the **light DOM** (`createRenderRoot() { return
this }`). It is an internal part of whichever element mounts it: sharing the
host's stylesheet keeps the SVG reachable from the host's `shadowRoot` (which
every story's play function relies on) and avoids a second shadow boundary. It is
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
`constants.ts` with every other colour because `<zx-diagram>` paints the SVG
background with it too, and a band in any other colour would be a stripe rather
than a gap. The casings are
their own layer under *every* wire rather than under their own: inside `g.link`
a casing would be painted over by whichever edges come after it and would cover
the ones crossing it. Every blue is painted before every gap, so two selected
edges crossing don't knock holes in each other.

Because a painter updates on its own cycle, anything that needs the SVG in the
DOM has to await it: the host overrides `getUpdateComplete()` and awaits every
mounted child before measuring the attributions. A measuring pass only
counts as done once *every* badge has been placed — one view can be measurable
while the other is not yet.

`<zx-hypergraph-viewer>` keeps one, the same way — the dragged dot positions —
and derives every blob outline, dot ring and trespass mark from that and the
host's selection in `render()`.

## Build

The toolchain is [Vite+](https://viteplus.dev) (`vp`), configured entirely in
`vite.config.ts`: `vp pack` (tsdown) builds, `vp check` formats (Oxfmt), lints
(Oxlint) and type-checks `src/`, and `vp test` runs Vitest.

- `vp pack` runs two builds. The first bundles `src/index.ts` →
  `dist/index.bundle.js` + `dist/index.bundle.d.ts`, minified, with lit
  inlined so the shipped bundle has zero runtime deps (lit stays an import in
  the declarations). The second builds `src/constants.ts` →
  `dist/constants.js` + `.d.ts` on its own, so the two share no chunk.
- `vp pack` sets `NODE_ENV` itself, so a development build (unminified, with
  sourcemaps) is asked for with `ZXCC_DEV=true` — that is what `build-dev` and
  `watch` set. `ANALYZE=true` adds the bundle visualiser.
- The bundle build also runs publint and arethetypeswrong (`esm-only`) over
  the package as a whole, and either one finding a problem fails the build —
  a broken `exports` map or a declaration file that doesn't resolve.
  `package.json` says `"sideEffects": true` outright, which publint would
  otherwise suggest setting to `false`: importing the bundle registers the
  custom elements, and a bundler told otherwise may drop it.
- `vp run test-node-entry` (`scripts/check-node-entry.mjs`, run in CI; it
  depends on `build`) imports `./constants` through the exports map in a separate Node
  process with no DOM shim and asserts the values, so anything that stops that
  entry loading in plain Node fails the build.
- `__ZXCC_VERSION__` (used by the attribution link) is injected by the `pack`
  `define` and, for Storybook, by vite `define` in `.storybook/main.ts`.
  Declared in `src/globals.d.ts`.
- Oxfmt's `embeddedLanguageFormatting` is off: it would otherwise reformat the
  insides of lit templates, and a newline between the children of an SVG
  `<text>` renders as a space (see *Conventions*).
- `typescript/no-floating-promises` is off for `stories/`: Storybook's
  instrumented `expect` is typed as returning a promise.
- `vp check` type-checks `tsconfig.json`, which covers `src/` only;
  `tsconfig.stories.json` is still checked by `tsc` in the `lint` task.
- Every command is a task in `run.tasks` in `vite.config.ts`, run with
  `vp run <name>` and cached: a rerun whose inputs haven't changed replays its
  output and restores the files it wrote. Inputs and outputs are found by
  watching what the command reads and writes. `package.json` keeps only the
  scripts something else runs by name — Chromatic runs `build-storybook`, npm
  runs `prepare` — plus `storybook`, which has nothing to cache. Formatting
  and fixing are the built-ins `vp fmt` and `vp check --fix`, with no script.
  `build`, `test` and `coverage` look like aliases for built-ins, but they are
  what makes those commands cached (a built-in run directly is not), and
  `build` is what `test-node-entry` depends on. `analyze` and `watch` are
  never cached.
- The test tasks exclude `node_modules/.cache` from their inputs and outputs:
  Storybook rewrites its cache there during a run, and a task that modifies
  its own input is never cached. `coverage` likewise leaves `coverage/` out of
  its inputs and its scratch `coverage/.tmp` out of its outputs.
- A development build inlines its sourcemap rather than writing a `.map`, so it
  writes exactly the files a production build does. A cached production build
  restoring over a development one would otherwise leave the `.map` behind.

## Committing

Sometimes this repository is managed with GitButler.
Check whether you are on the `gitbutler/workspace` branch; if so, use the `but` CLI to interact with it.
Make changes in new commits, as opposed to modifying existing commits, unless explicitly told to.

**Do not add attributions to yourself in commit messages**

## Conventions

- Lit decorators are on: `experimentalDecorators: true` and
  `useDefineForClassFields: false` in tsconfig. Use `@customElement`,
  `@property`, `@state`.
- `diagram`, `scene`, `colors`, `edgeColors` and `selection` are `{ attribute: false }`
  properties, not HTML attributes — they carry arbitrary objects.
- Templates use the `svg` tag for anything nested inside `<svg>`; only the
  root `<svg>` sits in an `html` template.
- **No whitespace between the children of an SVG `<text>`.** A newline in the
  template renders as a space, which widens the attribution badge and
  off-centres the scalar.
- Event listeners on the node/brush layers are delegated and bound as
  arrow-function class fields, so their identity is stable across renders and
  Lit doesn't rebind them.
- Every gesture is **pointer events** (`pointerdown` on the layer,
  `pointermove`/`pointerup`/`pointercancel` on window), so one set of handlers
  serves mouse, pen and finger. The plumbing is `trackPointer` in
  `gestures.ts`, shared by both painters. A press ignores anything but the
  primary pointer, and `trackPointer` then pins the gesture to that pointer's
  `pointerId`.
  Both halves are needed: the listeners are on window, so every pointer on the
  screen reports to them, and a second finger arriving mid-drag would otherwise
  drag whatever the first one picked up to wherever it is, and end the drag by
  lifting.
  `pointercancel` tears a gesture down the way an up does, but is not the same
  answer — the browser sends it once it decides the touch was a scroll after
  all, so it says the gesture was taken away rather than finished, and
  `trackPointer` passes the difference to `onEnd`. The brush is what needs it:
  it selects as it sweeps, and on a touch screen a cancelled brush *is* a pan starting on the
  canvas, so a cancel restores the selection the press established. Committing
  what the sweep had reached would mean panning across the picture selects
  whatever the finger passed over, with the rubber band that would have
  explained it already gone.
- Both painters sit inside a scroll container (`.container` in
  `viewerHost.ts`), which on a touch screen is panned by dragging. That is the
  same gesture as dragging a node, so **which one wins is decided per gesture,
  at the press**: a drag that starts on a node or a dot adds a non-passive
  `touchmove` handler calling `preventDefault()` for the length of the gesture,
  and a drag that starts anywhere else does not, leaving the pan available. It
  is done that way round rather than with `touch-action: none` on the shapes
  because a rule on the element can't tell the two apart — a picture wider than
  the screen is only reachable by panning the canvas, and the brush and the
  hypergraph's canvas press both start on the canvas. The handler goes on at
  the press because only the first `touchmove` of a gesture is cancellable;
  once a pan has begun nothing stops it.
- `<zx-diagram>` deliberately renders a single diagram. Layout of multiple
  panels (current vs. goal, side-by-side/stacked/hidden) lives in downstream
  consumers, not here.

## Testing

- Storybook interaction tests, run through `vitest` in **browser mode**
  (Playwright/chromium) via `@storybook/addon-vitest`. There are no unit
  tests and no jsdom — `vp run test` runs the stories' `play` functions.
  Chromatic snapshots the same stories on push.
- The play functions assert on rendered SVG attributes, so the DOM is a
  contract: `g.node` wrapping per-node `<g data-node>`, `g.brush >
  rect.overlay`, `path.selectable` for the ground symbol, `text[fill="#999"]`
  for id labels, the scalar as the only direct `<text>` child of the `<svg>`,
  a selected node marked by `#00f` in its shape's `style` and a selected edge
  by its casing — `g.casing > path[data-link]`, carrying the edge's index, with
  the wire in `g.link` left untouched — and `g.attribution` carrying a `rect`
  chip. In a `both` mode the
  two views are queried through one root, so anything ambiguous is scoped by
  painter tag (`zx-viewer …` / `zx-hypergraph-viewer …`). The hypergraph view has its own:
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
  `stories/interactionHelpers.ts`, `firePointer` among them: it builds the
  `PointerEvent` a gesture is dispatched as, `isPrimary` included, since a
  press without it is ignored. `shadowRootOf` takes a selector because a
  story may render a `<zx-graph>` or a `<zx-hypergraph>`, or several elements
  at once.
- A story's marks are spread over up to three shadow roots: `<zx-diagram>`'s
  own, and one for each element it mounts. `shadowRootOf` hands back a
  `ViewRoot` spanning them — `querySelector`/`querySelectorAll` across the lot,
  outer root first and then each view in the order it is drawn — rather than
  any one of them. That is what keeps a selector in a play function a statement
  about the picture rather than about how many elements deep it is drawn, and
  it is why the helpers take a `ViewRoot` and not a `ShadowRoot`. It awaits the
  element's `updateComplete` before looking for the views, since a host reports
  complete only once everything below it has.
- A press is read from what it *landed on*, so a play function that means to
  press a dot has to dispatch on the dot's `<g data-wire>` rather than on the
  SVG: a press whose target is the canvas asks which blobs contain the point,
  which is a different question with a different answer.
- Stories live outside `src/` so they stay out of the library build; `tsconfig.stories.json` type-checks them (wired into the `lint` task).
  `.storybook/preview.ts` imports `src/index` so the element registers before
  any story renders.
- `stories/` mirrors the `src/` split: `stories/graphs/` and
  `stories/hypergraphs/`, titled `Graphs/…` and `Hypergraphs/…` so Storybook
  groups them, plus `stories/other/` (`Other/…`) for what belongs to neither
  view. **A story uses the narrowest element that draws its picture**, which is
  what keeps each group about one thing: every `Graphs/…` story renders a
  `<zx-graph>`, and `Hypergraphs/Basic` a `<zx-hypergraph>`. `<zx-diagram>` is
  reached for only where the point *is* the diagram behind the dual —
  `Hypergraphs/From graph` and `Other/Both viewers` — and in `Other/Tests`,
  where the element that reports an error is half of what is being tested.
  `Hypergraphs/Basic` is the hypergraph written out, and is where a picture no
  layout would produce belongs; its third and fourth stories are the same
  hypergraph drawn at two scales side by side, once placed on the grid and once
  in pixels: on the grid `scale` moves the dots as well as sizing them, in
  pixels it sizes them alone. That pair is what the two placements are *for*,
  and it is the one property with nothing to check in `From graph`, where
  `scale` comes from the diagram. `Hypergraphs/From graph` is the same element
  reached the other way, and what it has to show that `Basic` doesn't is the
  pinning. The shared `diagrams.ts`/`interactionHelpers.ts` and the `Playground`
  story sit at the top level; `Playground` keeps its `<zx-diagram>`, since a
  `view-mode` control is the whole of it. The sidebar order is pinned by
  `storySort` in `.storybook/preview.ts`.
- `Other/Both viewers` is the pair drawn together, and the home of every
  `<zx-diagram>` property whose work only shows up with both views on screen:
  the two arrangements; `show-labels` and `scale`, which do different things in
  each view (node ids over there, blob names and wire ids here); `Shared
  palette`, which is also where the composition itself is asserted — that the
  element mounts a `<zx-graph>` and a `<zx-hypergraph>` and hands both the same
  resolved palette; and `Without input/output blobs`, which lives here rather
  than under `Hypergraphs/` because `disable-io-blobs-in-hypergraph` is
  `<zx-diagram>`'s alone and what it costs is read off the pair — the blobs
  that went, and the one thing that survives them: an input pressed in the
  diagram still rings its leg in the dual. Every story
  runs `both-vertical`, since one view would check half of what a property
  does.
- `Other/Tests` is the group whose stories exist for their play function rather
  than their picture, and the whole group carries
  `chromatic: { disableSnapshot: true }` on its `meta`. It holds `Error states`:
  all seven failure cases — malformed diagram, a node the dual has no shape for,
  an unknown `view-mode`, a hypergraph naming a blob shape that doesn't exist,
  one whose wire is held by three hyperedges, one whose wire is only half
  placed, and one whose wire is placed both ways — in one story, since the UI
  is the same grey `<pre>` and Retry button whatever caused it and the
  *message* is the whole of what is being tested, so
  seven stories would be seven snapshots of one box. All three elements report
  through it, which is the point of them sharing a host — and the malformed
  diagram is the case where the report comes from a `<zx-graph>` mounted inside
  the `<zx-diagram>` the story wrote, since the diagram's own layout is the
  child's to run. It also holds `Identity wire with the boundary blobs dropped`,
  the one diagram where dropping them leaves a dot with a blob at neither end:
  the picture is a single dot and not worth a snapshot, but that it draws at all
  — rather than being a wire held by nothing — and that pressing the input still
  rings it are what the `boundaries` list is for.
- `color-scheme` is the one presentation property *not* under `Other/Both
  viewers`, and the reason is the palette: `Zalt`, `W` and `Walt` belong to node
  types the dual has no blob shape for, so a both-view colour story would have
  to run on a diagram missing exactly the entries worth checking (that a Z-*box*
  sits out the rgb scheme's Y/Z swap, say). The three scheme stories therefore
  stay on the full `paletteShowcase` under `Graphs/Advanced`, the one view that
  draws every entry. Nothing asserts that a scheme reaches the *dual* — the
  shared `nodeColor`/`edgeColor` lookups in `colors.ts` are what make that true
  by construction, and `Hypergraphs/Basic` carries a `color-scheme` control to
  see it by eye.

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
- Default H-box phase is `π`, and a spider phase of `0` — both render no
  text (pyzx convention). Both are string comparisons against the
  pre-formatted phase, so `0` suppresses and `0.0` or `2π` does not; a
  `labels` override still draws, since it says outright what to write. A
  Z-box keeps its `0`: its phase is a parameter whose default is 1, so 0 is
  worth saying. `placeNodes` in `layout.ts` is the single home for all of
  this — the hypergraph reads the result off `SceneNode.text` rather than
  applying the conventions again.
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
- `scale` does two jobs on a `HypergraphInput`, and only one of them on a
  pixel-positioned one. On the grid it sets the spacing *and* the weight of
  every mark, so the whole drawing grows with it. In pixels the positions are
  already fixed, so raising it grows the dots and the blob standoffs without
  moving anything — which looks like a bug the first time you try it. That is
  the price of one builder serving both routes, and the derived route is always
  the pixel one.
- Spreading dots does *not* reduce the trespass tally, and isn't meant to. Every
  trespass at rest is a coincidence — measured, the whole tally — and separating
  the dots converts each one into a dot sitting inside a neighbouring hull
  instead. Clearing those needs every crowded dot moved half a scale or more,
  which is a different problem from two dots drawn on one spot.
