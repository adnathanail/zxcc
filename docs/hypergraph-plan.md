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
- **Hyperedges**: one per non-boundary ZX node, id `e<node id>`, carrying a
  display `label` (`Z(π/2)`, `X(0)`, `H`, `W-in`, `Zbox(…)`) and the ids of its
  incident wires.

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
- **Every non-boundary vertex becomes a hyperedge**, not only spiders — W-in,
  W-out, Z-box and `wire` nodes are vertices with incident wires too.

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

   Only spiders and Hadamards have a blob shape. A W, Z-box or `wire` node is not supported.

5. **Labels.** Open. Drawn under `show-labels` — the wire id under each dot,
   the hyperedge label over the top of each blob — and they collide when blobs
   are close.
6. **Interaction.** Not started. The viewer is static, but it already derives
   outlines from a dot-position map in `render()`, so dragging is a matter of
   making that map state and mutating it.

## Next

- Label placement: both label kinds pile up on a dense diagram.
- The ZX-derived layout keeps the views comparable but leaves the blobs
  wherever the diagram put them — the four-spider square draws blobs that
  cross. A layout computed from the hypergraph itself would fix that at the
  cost of the correspondence.
- Interactions: dragging dots, and whether selection means anything here.
- Play functions. The stories currently only render; the ZX ones assert on the
  SVG, and the DOM here (`g.blob > g[data-hyperedge] > path`, `g.dot >
  g[data-wire]`) is a contract in the same way.
