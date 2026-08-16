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
   `spreadCoincident` pulls such a group apart in one pass. Measured across the
   stories, dots are otherwise never merely *close*: on an integer grid every
   midpoint is a multiple of half a scale, so two dots either coincide exactly
   or sit half a column (40px at the default scale) apart. That is why the fix
   is a tie-break rather than a re-layout onto a finer grid — the midpoints
   already are the grid. A wider spread was tried and is worse: it pushes each
   tied dot up against the next dot in the column, pairing it with the wrong
   partner.
3. **Blob geometry.** The rounded convex hull of the node and its dots, cut
   back around foreign dots and rounded off. On a plain chain that is exactly
   the old capsule; the cuts only appear where a dot that isn't the blob's own
   would otherwise be swallowed.

   A purely convex outline is wrong and not fixably so: a hull spans everything
   between its dots, so a foreign dot lying between two of a spider's legs is
   inside any hull holding both. In the strong complementarity diagram the dot
   for 1—6 sits square between two of node 2's legs, and moving the dots about
   only changes *which* blob wrongly swallows *which* dot.

   A pure star of corridors from the node was tried in between. It is correct
   and much simpler, but it reads as spindly: the shape people draw by hand is
   fat and hull-like, pinching in only where it has to. The star survives as
   the floor term — the outline never cuts inside the corridor to one of its
   own dots.

   The outline stands off its own dots by the blob radius, but keeps clear of
   a foreign dot by a multiple of the radius *that dot is drawn at* — the two
   were briefly the same number, which made the boundary swerve around a
   circle four times the size of the dot it was dodging.

   Everything is a **reach**, one distance per direction from the node, which
   keeps the boundary a single closed loop that cannot cross itself and makes
   the hit test identical to the outline. Overlapping blobs are still told
   apart only by their outlines crossing over a translucent fill.

   A cut leaves a corner where it rejoins the hull. Rounding those off by
   averaging the reach over a few degrees was tried and dropped. Averaging can
   only pull the boundary *in*, which sounds safe and is the opposite: pulling
   in cannot break the clearance around a dot the blob dodges (measured: 11.9px
   either way) but it cuts straight through the floor holding the boundary off
   a dot the blob *keeps* — 6.3px from a dot drawn at 6px, against 17.2px
   without it. `expectBlobBreathingRoom` now guards that, and fails on the
   smoothed outline.
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

## Where it stops working

`strongComplementarityOf(z, x)` in `stories/diagrams.ts` builds the n-to-m
strong complementarity diagram — every Z spider joined to every X spider — and
story 7 draws it at 4-to-4. It is the worst case by construction: every Z—X
wire crosses every other, so all their dots land in the one column between the
ranks, and every blob has to reach across that column past dots it doesn't own.

Measured off the painted SVG (a spider of degree d contributes d dot-in-blob
incidences, so the expected total is 2n(n+1)):

| size | dots | blobs | incidences (expected) | tightest own-dot gap |
| --- | --- | --- | --- | --- |
| 2×2 | 8 | 4 | 12 (12) | 17.3px |
| 3×3 | 15 | 6 | 26 (24) | 17.3px |
| 4×4 | 24 | 8 | 50 (40) | 1.5px |

So it is exact at 2×2, leaks two dots at 3×3, and at 4×4 a quarter of the
incidences are wrong and the outline is squeezed to 1.5px off a dot it holds.

**This is density, not the outline model.** The same algorithm on the same
diagram, with `ZOOM` raised so the dots have more room:

| `ZOOM` | incidences (expected 40) | tightest own-dot gap |
| --- | --- | --- |
| 1.6 (current) | 50 | 1.5px |
| 2.4 | 44 | 2.4px |
| 3.2 | 40 | 16.6px |

At 3.2 the 4×4 case is exactly right again. The fix is therefore room rather
than a cleverer shape: a zoom that grows with how many dots share a column,
or a layout that stops piling every crossing's dot into the same column in the
first place. Whichever it is, `expectBlobMembership` and
`expectBlobBreathingRoom` are the check — they are not asserted on story 7 yet
precisely because it fails them today.

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
- Play functions. The stories currently only render; the ZX ones assert on the
  SVG, and the DOM here (`g.blob > g[data-hyperedge] > path`, `g.dot >
  g[data-wire]`) is a contract in the same way.
