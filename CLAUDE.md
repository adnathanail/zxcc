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

One module is knowingly out of step with rule 2: `colors.ts` sits in `src/`
but only `graph/` imports it so far. It is there in preparation — the palettes
are public API surfaced by `<zx-diagram color-scheme>`, and colouring blobs
from a spider's palette entry is the next thing planned for the hypergraph
view (`docs/hypergraph-plan.md`, item 4). Every other root module satisfies
the rule outright.

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
  `linkPath` draws that curve and `wireDot` evaluates it at t = 0.5, so the
  painted wire and the hypergraph's dot on it cannot disagree.
- `colors.ts` — the pyzx palettes and the scheme lookup. See the note above:
  the hypergraph view doesn't read them yet.
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
  ZX edge) and hyperedges (one per non-boundary ZX node).
- `geometry.ts` — `wireDot` (where a wire's dot sits), `convexHull`/`blobPath`
  (the outline enclosing a set of dots), and `blobOutline`/`blobLabelAnchor`
  over a live dot-position map.
- `layout.ts` — `layoutHypergraph`, parking each wire's dot at the midpoint of
  its edge so the two views line up, then zooming the positions, since the
  dual has twice the marks at half the spacing.
- `viewer.ts` — `<zx-hypergraph-viewer>`, the second painter. Internal, light
  DOM, and static — no interactions yet.

## The elements

`<zx-diagram>` runs `layout()` in `willUpdate()` into `@state` (`scene` /
`hypergraph` / `error`), then renders one of the two painters inside a scroll
container — `<zx-viewer>`, or `<zx-hypergraph-viewer>` when
`view-as-hypergraph` is set. The two states are mutually exclusive: only one
view is built per update. It owns the presentation properties that mirror
pyzx's `draw_d3` keyword arguments (`show-labels`, `color-scheme`, `scale`,
`colors`), resolves a scheme name to a palette, and passes the attribution
badge down as the painter's `overlay`. It carries the stylesheet for the whole
shadow tree, the painters' SVG included.

Both painters render into the **light DOM** (`createRenderRoot() { return
this }`). It is an internal part of `<zx-diagram>`: sharing the host's
stylesheet keeps the SVG reachable from `zx-diagram.shadowRoot` (which every
story's play function relies on) and avoids a second shadow boundary. It is
deliberately not exported — promoting it later (own shadow root + export) is
non-breaking; demoting it would not be.

The viewer stores exactly four pieces of interaction state — dragged
positions, H-box line parameters, the selection, and the live brush rect —
and derives everything else (H-box positions, box bounds, edge paths) in
`render()`. There is no imperative "sync the DOM to the model" pass; a drag
mutates state and calls `requestUpdate()`. Those fields are plain private
fields rather than `@state()` precisely because they are mutated in place and
paired with an explicit `requestUpdate()`.

Because a painter updates on its own cycle, anything that needs the SVG in the
DOM has to await it: `<zx-diagram>` overrides `getUpdateComplete()` and awaits
whichever child is mounted before measuring the attribution.

`<zx-hypergraph-viewer>` holds no interaction state at all yet — it derives
every blob outline from the dot positions in `render()`, the same way, so
adding drags means making that map state rather than restructuring it.

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

**Do not add attributions to yourself in commit messages**

## Conventions

- Lit decorators are on: `experimentalDecorators: true` and
  `useDefineForClassFields: false` in tsconfig. Use `@customElement`,
  `@property`, `@state`.
- `diagram`, `scene` and `colors` are `{ attribute: false }` properties, not
  HTML attributes — they carry arbitrary objects.
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
  and `g.attribution` carrying a `rect` chip. Shared query/gesture helpers
  live in `stories/interactionHelpers.ts`.
- Stories live outside `src/` so they don't get emitted by the library `tsc`
  build; `tsconfig.stories.json` type-checks them (wired into `npm run lint`).
  `.storybook/preview.ts` imports `src/index` so the element registers before
  any story renders.

## Gotchas

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
