# Hypergraph view

The dual reading of a ZX diagram: wires become nodes, spiders become hyperedges.

| ZX diagram | Hypergraph | Drawn as |
| --- | --- | --- |
| edge (wire) | node | a dot on the wire |
| node — spider, Hadamard, boundary | hyperedge | a blob enclosing the dots of its legs |

```
DiagramData --layout()--> Scene --layoutHypergraph()--> HypergraphScene --<zx-hypergraph-viewer>--> SVG
```

`toHypergraph` — convert graph to hypergraph
`layoutHypergraph` - position hypergraph elements by pixel

## Decisions — the conversion

- **Every ZX node is a hyperedge, boundaries included.** A boundary holds one
  wire, so its blob is a circle around a single dot. Without one, a boundary leg
  and a self-loop are the same picture — a dot held by exactly one blob. With
  one, the count reads straight off the drawing: every dot is in two blobs, one
  per end of its wire, and a self-loop's is the only dot in one, since its two
  ends are the same node. (This reverses the original call, which left
  boundaries out as "just the loose end of a wire".)
- **A self-loop appears twice** in its spider's wire list, so a hyperedge's
  length is the spider's arity rather than its neighbour count.
- **Parallel edges stay distinct wires** — two dots, not one.
- **A Hadamard edge and a Hadamard node stay distinct.** The edge is one wire
  carrying `kind: 'hadamard'`; the node is its own arity-2 hyperedge. They are
  two encodings of the same thing in `DiagramData` and they draw differently
  here. Still not normalised — see below.
- **Only spiders, Hadamards and boundaries convert.** A W-in, W-out, Z-box or
  `wire` node has no blob shape, so `blobKind` rejects the diagram by name at
  conversion time — the earliest point — and nothing downstream ever meets a
  kind it can't paint.
- **A hyperedge carries `name` and `phase` apart** as well as the joined
  `label`, which is what lets `show-labels` drop the name and keep the phase.

## Decisions — the drawing

- **Laid out from the ZX layout, not from the hypergraph.** A dot parks at the
  midpoint of the same `edgeCurve` the graph painter strokes (`src/curves.ts`),
  so the painted wire and the dot standing for it cannot disagree, and the two
  pictures can be read side by side. This is the central trade of the whole
  view, and the source of most of what is still open.
- **Positions are zoomed by `ZOOM` (1.6) before the curves are built.** The dual
  has twice the marks at half the spacing, so it is drawn roomier; blob and dot
  radii stay in unzoomed units, so the zoom also buys the gap between
  neighbouring blobs. Zooming first rather than last matters for exactly one
  shape — a self-loop's arc is a fixed pixel height, not a fraction of anything.
- **Colliding dots slide along their own wires, not down the column.** Two crossing
  wires share a midpoint. The column is the one direction already full —
  consecutive midpoints sit half a ZX scale apart on it — so a group opened that
  way lands on its neighbours' dots. Counting pairs of dots drawn on top of one
  another, on the n-to-m story:

  | | 2×2 | 3×3 | 4×5 | 6×6 |
  |---|---|---|---|---|
  | midpoints, unspread | 1 | 5 | 20 | 55 |
  | spread down the column | 0 | 2 | 5 | 27 |
  | slid along their wires | 0 | 0 | 0 | 8 |

  From 4×4 up, spreading down the column puts dots back on the *same point* it
  cleared them from. Sliding never does. Sitting at the exact midpoint is not
  worth preserving: two wires can share that point, and then it says nothing.
- **A blob is the convex hull of its dots**, offset outwards with arcs at the
  corners — one dot gives a circle, two a capsule, so arity 2 is fine.
- **Colour comes from the shared lookups in `src/colors.ts`**, so a spider and
  the blob standing for it, or a wire and the dot standing for it, cannot come
  out different colours.
- **Selection is held in the diagram's terms** — ZX node ids and edge indices —
  and owned by `<zx-diagram>`, so the two views track each other with no
  translation step in between. A press on canvas asks what is *here* (geometry);
  a press on a dot asks which hyperedges that wire is *part of* (membership).
- **Blobs that swallow a dot they don't hold are drawn, not designed away**: a
  red copy of the dot clipped to the outlines it has strayed into, plus a tally.

## Still open

- **What the dual doesn't draw.**
  - Pauli webs
  - `stack`/`compose` boxes
  - ground symbols
  - `vdata` annotations
  - global scalar
    — the layout reserves the scalar's strip so the pair line up in a `both` mode,
      but paints nothing in it.
- **Label placement.** Both kinds pile up on a dense diagram: a blob's caption
  sits just off the top of its hull, and a wire id hangs a fixed distance below
  its dot, which lands on the dot beneath in a crowded column. Visible in the
  middle of the strong-complementarity story. Selected blobs get a dashed leader
  from caption to blob, which fixes *attribution* in a pile of overlapping blobs
  but not collision.
- **Laying the hypergraph out from the hypergraph.** The ZX-derived layout is
  what keeps the two views comparable, and also what leaves blobs crossing where
  the diagram happened to put their spiders — the four-spider square draws
  blobs that overlap for no reason of its own. A layout of its own would fix
  that and give up the correspondence. Everything below points here.
- **Trespassing dots.** Measured, and none of the cheap fixes touch it: `ZOOM`
  (1→4), `BLOB_RADIUS` (0.35→0.1), and drawing a blob as its spider's legs
  thickened rather than as a hull all leave the tally *identical* — the last
  flags the same pairs, not merely the same number. Spreading tied dots doesn't
  help either: every trespass at rest is a coincidence (the dot is sitting on
  one of that blob's own dots), so separating them converts each into a dot
  strictly inside a neighbouring hull. What does clear it is moving every
  crowded dot, not just the tied ones — with a half-scale displacement budget
  2×2 and 3×3 reach zero, while 4×5 does not get there at any budget. That is
  the item above, not a nudging rule on top of the ZX positions.
