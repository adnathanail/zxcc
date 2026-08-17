# Hypergraph view — plan

Working notes for representing a ZX diagram as a hypergraph and drawing it.
Step 1 (the conversion + a text dump) and a first drawing — dots and blobs, no
colour and no interaction — are both implemented.

## The representation

The roles of wires and spiders swap:

| ZX diagram | Hypergraph |
| --- | --- |
| edge (wire) | node — drawn as a dot |
| spider | hyperedge — drawn as a shape enclosing the dots it contains |

A 4-spider square with 4 dangling boundary wires becomes 8 dots and 4 blobs,
each blob enclosing the 3 dots of its spider's legs.

## What exists (`src/hypergraph/convert.ts`)

`toHypergraph(diagram: DiagramData): HypergraphData` — pure, DOM-free, sits off
to the side of the `DiagramData --layout()--> Scene --<zx-viewer>--> SVG`
pipeline rather than inside it.

- **Wires**: one per ZX edge, id `w<edge index>`, carrying `src`/`tgt`, the
  edge's `kind`, and which endpoints are boundaries.
- **Hyperedges**: one per non-boundary ZX node, id `e<node id>`, carrying its
  `kind` (`z-spider`, `x-spider`, `hadamard`), a display `label` (`Z(π/2)`,
  `X(0)`, `H`) and the ids of its incident wires.

`toHypergraph` is exported from the package entry, so the conversion is usable
standalone; `layoutHypergraph` is not — its output is pixel-space and internal,
like `Scene`.
Stories live in `stories/Hypergraph.stories.ts`.

A `formatHypergraph` used to dump the same data as text, which is what
`view-as-hypergraph` showed before the drawing existed. It has been removed —
nothing in the package renders text any more, and a debug dump of a plain
object is not worth an export.

## Decisions taken

These are the calls made in the conversion. Each is cheap to revisit and each
matters for the drawing, so they're worth re-reading before starting on it.

- **Boundaries are not hyperedges.** An `input`/`output` node is just the loose
  end of a wire, so a boundary edge becomes a wire that only one hyperedge (or
  none, for a bare identity wire) contains. This matches the sketch, where the
  dangling wires are dots that nothing wraps on its own.
- **Self-loops appear twice** in their spider's wire list, so a hyperedge's
  length is the spider's arity. Making hyperedges true sets instead is a
  one-line change.
- **Parallel edges stay distinct wires** — two dots, not one.
- **A Hadamard edge stays one wire**, with `kind: 'hadamard'` riding along on
  it; an explicit `hadamard` *node* becomes its own arity-2 hyperedge. Those
  are two encodings of the same thing in `DiagramData` and they land
  differently here. Worth deciding whether to normalise one into the other.
- **Only spiders and Hadamards become hyperedges.** A W-in, W-out, Z-box or
  `wire` node is a vertex with incident wires too, but none of them has a blob
  shape to be drawn as, so the conversion rejects the diagram outright rather
  than producing a hyperedge nothing downstream can paint. That check is in
  `toHypergraph` — the earliest point — so `layoutHypergraph` and the viewer
  only ever see the three kinds they have answers for.

## The drawing (`src/hypergraph/`)

`layoutHypergraph(diagram, scene): HypergraphScene` is the dual's own pipeline
stage, and `<zx-hypergraph-viewer>` paints it:

```
Scene --layoutHypergraph()--> HypergraphScene --<zx-hypergraph-viewer>--> SVG
```

`<zx-diagram view-as-hypergraph>` runs that on the `Scene` `layout()` gives it,
in place of handing the scene to `<zx-viewer>`, and gets the container,
`show-labels` and the attribution badge for free.

`src/hypergraph/` is now a folder beside `src/graph/`, holding the same four
stages: `types.ts`, `convert.ts`, `geometry.ts`, `layout.ts`, `viewer.ts`. It
imports nothing from `graph/` — see CLAUDE.md for the two rules that keep the
folders apart.

What the two views genuinely share is in `src/curves.ts`: `edgeCurve` says
where the wire between two points runs, and both `linkPath` (which draws it)
and `wireDot` (which takes its midpoint) are one line over it. Neither view
describes the curve itself, so neither can drift from the other.

Answers to the questions above, as built:

1. **Where it lives.** A second painter alongside `<zx-viewer>`, internal and
   light-DOM for the same reasons, with `<zx-diagram>` still the only public
   element. Promoting it to `<zx-hypergraph>` later stays open.
2. **Layout.** Derived from the ZX layout: `wireDot` puts a dot at `t = 0.5`
   on the same `edgeCurve` the viewer paints, so parallel edges get dots
   fanned apart the way their arcs are and a self-loop's dot rides inside its
   loop. Positions are then scaled by `ZOOM` (1.6): dots land on midpoints, so
   consecutive dots are half a ZX scale apart — twice the marks at half the
   spacing. Blob radius and dot radius stay in unzoomed units, so zooming also
   buys the gap between neighbouring blobs.

   Two edges that cross share a midpoint, so their dots would coincide;
   `spreadCoincident` pulls such a group apart in one pass, sliding each dot
   along its own wire (`wireCurve` at `t ≠ 0.5`) until the group clears three
   dot radii. Sliding rather than pushing down the column is the whole point:
   the column is where the other dots already are — consecutive midpoints are
   half a scale apart on it — so a group opened that way runs into its
   neighbours. Measured on the n-to-m story, counting pairs of dots drawn on
   top of one another:

   | | 2×2 | 3×3 | 4×5 | 6×6 |
   |---|---|---|---|---|
   | midpoints | 1 | 5 | 20 | 55 |
   | spread down the column | 0 | 2 | 5 | 27 |
   | slid along their wires | 0 | 0 | 0 | 8 |

   Spreading down the column also puts dots back on the *same point* from 4×4
   up (3 pairs at 4×5), because a group of four spans exactly its neighbour's
   slot. Sliding never does. Neither approach touches the trespass tally — every
   trespass at rest is a coincidence, and separating the dots just turns each
   into a dot inside a neighbouring hull; see the note in `Next`.
3. **Blob geometry.** `blobPath` — convex hull, offset outwards by a radius,
   arcs at the corners. One dot gives a circle, two a capsule, more a rounded
   convex polygon, so arity 2 is fine. Overlapping blobs are currently told
   apart only by their outlines crossing over a translucent fill.
4. **Colour.** Done. A blob is filled with the palette entry its own node
   would be painted with — Z green, X red, H yellow — at 40% opacity with a
   black outline, so an overlap reads as both colours and the picture matches
   the diagram it came from. A dot takes its edge's colour, so an H-wire's dot
   is blue. `color-scheme` now applies to both views. The lookups
   (`nodeColor`, `edgeColor`) live in `src/colors.ts` so the two painters
   can't disagree, which is also what makes `colors.ts` a legitimate root
   module under the folder rules.

   Only spiders and Hadamards have a blob shape. A W, Z-box or `wire` node is
   not supported, and `toHypergraph` says so rather than picking a colour.

5. **Labels.** Open. Drawn under `show-labels` — the wire id under each dot,
   the hyperedge label over the top of each blob — and they collide when blobs
   are close.
6. **Interaction.** Selection only. A click selects every blob whose outline
   contains the point — all of them, not the topmost, since overlapping is the
   norm and seeing which blobs share a spot is the point of clicking. The hit
   test is `blobContains`, geometry rather than SVG hit-testing. Dragging is
   still open, and still a matter of making the dot-position map state.

## Next

- Label placement: both label kinds pile up on a dense diagram.
- The ZX-derived layout keeps the views comparable but leaves the blobs
  wherever the diagram put them — the four-spider square draws blobs that
  cross. A layout computed from the hypergraph itself would fix that at the
  cost of the correspondence.
- Dragging dots, and whether selection should mean more than "show me this
  blob" — the graph view's selection drags.
- Labels in a crowded column. Each dot's label hangs a fixed distance below
  it, which lands on the dot beneath when a column is dense — visible in the
  middle of the strong complementarity story now that the tied dots are
  spread. Part of the labels item above.
- **Blobs swallowing dots they don't hold** — the red marks and the tally — is
  a separate problem from dots overlapping, and spreading does not help it.
  Measured: every trespass at rest is a *coincidence* (the dot is on one of that
  blob's own dots), so the tally counts collisions today; separating the dots
  turns each into a dot strictly inside a neighbouring hull and the count is
  unchanged. Also measured, on the n-to-m story: `ZOOM` (1→4), `BLOB_RADIUS`
  (0.35→0.1) and drawing a blob as the spider's legs thickened instead of a
  convex hull all leave the tally *identical* — the last flags exactly the same
  pairs, not merely the same number. What does clear it is moving every crowded
  dot, not just the tied ones: with a half-scale displacement budget the 2×2 and
  3×3 cases reach zero, while 4×5 does not get there at any budget. That points
  at laying the hypergraph out from the hypergraph (the item above) rather than
  at any nudging rule on top of the ZX positions.
- Play functions. The stories currently only render; the ZX ones assert on the
  SVG, and the DOM here (`g.blob > g[data-hyperedge] > path`, `g.dot >
  g[data-wire]`) is a contract in the same way.
