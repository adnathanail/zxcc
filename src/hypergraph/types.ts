// Data contracts for the hypergraph view, the way `src/types.ts` holds the
// ones for the diagram itself. There is one way to a `HypergraphScene`, and two
// ways to the `HypergraphInput` it is built from:
//
//   DiagramData + Scene --toHypergraph()--> HypergraphData
//                        --layoutHypergraph()--> HypergraphInput (pixel form)
//   (written by hand)                     --> HypergraphInput (grid form)
//                        --hypergraphScene()--> HypergraphScene
//                        --<zx-hypergraph-viewer>--> SVG
//
// `HypergraphInput` is the public shape: the hypergraph itself, plus where each
// dot goes. A caller writes one out on the column/qubit grid; `layoutHypergraph`
// produces one in pixels, having taken those pixels from the diagram's own
// layout. Both go through the same builder, which is why `<zx-diagram>` can
// hand its dual to a `<zx-hypergraph>` rather than to a painter directly.
//
// `Hypergraph{Wire,Edge,Data}` is `toHypergraph`'s output — the dual of a
// diagram as pure combinatorics, with no coordinates.
// `Hypergraph{Dot,Blob,Scene}` is the laid-out result, and is internal to the
// package.

import type { DiagramEdgeKind, NodeKind } from '../types'

// —————————————————————————————————————————————————————————————————————————
// Input: the hypergraph, and where to draw it
// —————————————————————————————————————————————————————————————————————————

/** What every wire says regardless of how it is positioned. */
interface HypergraphInputWireBase {
  /** Which colour the dot takes, as a wire kind — `hadamard` for the blue an
   *  H-wire's dot is filled with, or a kind of your own named in
   *  `<zx-hypergraph>`'s `edgeColors`. Defaults to a plain wire. */
  kind?: DiagramEdgeKind
  /** What a selection names this wire by — an index into `diagram.edges` when
   *  the input came from a ZX diagram, and whatever the caller likes otherwise.
   *  Defaults to the wire's position in `wires`. Must be unique. */
  id?: number
}

/** A wire placed on the grid: the same column/qubit grid `layout()` puts a ZX
 *  diagram on, drawn `GRID_STEP` `scale`s to the square so that neighbouring
 *  blobs have room to stand off their dots. The grid is read relative to its
 *  own lowest column and qubit, so negative coordinates are fine, and
 *  fractional ones put a dot between two squares. */
export interface HypergraphInputGridWire extends HypergraphInputWireBase {
  col: number
  qubit: number
  x?: never
  y?: never
}

/** A wire placed in pixels, used verbatim: no origin is subtracted and no
 *  padding is added, so the coordinates are the ones the dot is drawn at. This
 *  is the form `layoutHypergraph` produces, where every position is already
 *  pinned to the diagram the dual came from and moving any of it would break
 *  that. `scale` still sets how big a dot is and how far a blob stands off
 *  one — it just no longer sets where they go. */
export interface HypergraphInputPixelWire extends HypergraphInputWireBase {
  x: number
  y: number
  col?: never
  qubit?: never
}

/** A hypergraph node, drawn as a dot. It stands for a wire, which is what a ZX
 *  edge becomes in the dual, so it is one here too — `<zx-hypergraph-viewer>`
 *  paints it with an edge's colour and `show-labels` writes an edge's id under
 *  it.
 *
 *  Positioned one way or the other, never both and never neither: a grid
 *  coordinate and a pixel coordinate are measured from different origins, so an
 *  input mixing them has no single drawing. */
export type HypergraphInputWire = HypergraphInputGridWire | HypergraphInputPixelWire

/** A hyperedge, drawn as a blob around the dots of the wires it holds. */
export interface HypergraphInputHyperedge {
  /** Which shape and colour the blob takes — the same palette entry the ZX node
   *  it stands for would be painted with. */
  kind: HyperedgeKind
  /** Indices into `HypergraphInput.wires`, in any order. A wire listed twice is
   *  a self-loop: both of its ends are this hyperedge, and it is drawn as one
   *  dot. */
  wires: number[]
  /** What the blob is called — `Z`, `X`, `H`, `in`, `out`. Written only when
   *  `show-labels` is on. Defaults to the letter for its kind, and to nothing
   *  for a boundary, which is the one kind that doesn't say which end of the
   *  diagram it is. */
  name?: string
  /** The phase, pre-formatted (`π/2`), drawn under the blob whether labels are
   *  on or off — the same split `<zx-viewer>` makes between a node's id and the
   *  phase written under it. Empty for a node carrying none. */
  phase?: string
  /** What a selection names this hyperedge by — a ZX node id when the input
   *  came from a diagram, and whatever the caller likes otherwise. Defaults to
   *  the hyperedge's position in `hyperedges`. Must be unique. */
  id?: number
}

/**
 * A hypergraph and where to draw it, as `<zx-hypergraph>` takes it: the dots
 * and where each goes, and which of them each blob holds.
 *
 * Every wire is held by one or two hyperedge ends. Two is the ordinary case —
 * the two ZX nodes its edge runs between, or one hyperedge twice for a
 * self-loop, or a spider and a boundary for a leg hanging out of the diagram.
 * One is what is left when a hyperedge that would have held it isn't drawn,
 * which is what `<zx-diagram disable-io-blobs-in-hypergraph>` does to every
 * boundary. Three has no meaning here: a dot's `src` and `tgt` are the
 * hyperedges holding it, which is how a press on it answers in the diagram's
 * terms, so a wire held by three has no answer to give. That is what makes this
 * a ZX diagram written the other way round rather than a hypergraph in general,
 * and `hypergraphScene` checks it.
 */
export interface HypergraphInput {
  wires: HypergraphInputWire[]
  hyperedges: HypergraphInputHyperedge[]
  /** The canvas to draw on, in pixels. Given, it is used as it stands; left
   *  out, one is measured around the dots with room for what is drawn outside
   *  them. `layoutHypergraph` gives it, because the dual's canvas is the ZX
   *  layout's own zoomed rather than anything the dots imply — that is what
   *  makes the pair the same size in a `both` mode. */
  width?: number
  height?: number
}

// —————————————————————————————————————————————————————————————————————————
// The dual, as combinatorics
// —————————————————————————————————————————————————————————————————————————

/** A ZX edge. Hypergraph nodes are wires — that is the swap. */
export interface HypergraphWire {
  /** Stable id, `w<edge index>`. */
  id: string
  /** The ZX edge this wire came from. */
  src: number
  tgt: number
  /** The edge's render kind, carried through so an H-wire stays
   *  distinguishable from a plain one. */
  kind: DiagramEdgeKind
  /** Boundary endpoints of the underlying edge, in `src`, `tgt` order. A wire
   *  with any of these dangles out of the diagram rather than joining two
   *  spiders. */
  boundaries: { nodeId: number; kind: 'input' | 'output'; ioId?: number }[]
}

/** The ZX nodes that have a blob shape. A diagram carrying any other node
 *  can't be drawn as a hypergraph yet, and `toHypergraph` says so rather than
 *  picking a colour for it — so nothing downstream of the conversion has to
 *  consider the other node types at all. */
export type HyperedgeKind = Extract<NodeKind, 'z-spider' | 'x-spider' | 'hadamard' | 'boundary'>

/** A ZX node, as the set of wires incident to it. */
export interface HypergraphEdge {
  /** Stable id, `e<node id>`. */
  id: string
  /** The ZX node this hyperedge came from. */
  nodeId: number
  /** What the node is, and so which palette entry its blob is painted with —
   *  the same one the node itself would be. */
  kind: HyperedgeKind
  /** What the node is, without its phase: `Z`, `X`, `H`, or `in`/`out` for a
   *  boundary. */
  name: string
  /** The phase on its own, e.g. `π/2`, and empty for a node that carries
   *  none. Kept apart from the name because the two are drawn differently —
   *  the name is what `show-labels` adds, and the phase is painted in the
   *  diagram view's blue whether labels are on or not. */
  phase: string
  /** The two joined, e.g. `Z(π/2)`, `X(π)`, `H` — the one-string form, for a
   *  caller that wants a label rather than the pieces. */
  label: string
  /** Incident wire ids, in edge order. A self-loop appears twice — the
   *  spider's arity counts both of its legs. A boundary has exactly one. */
  wires: string[]
}

export interface HypergraphData {
  wires: HypergraphWire[]
  hyperedges: HypergraphEdge[]
}

// —————————————————————————————————————————————————————————————————————————
// Laid-out scene
// —————————————————————————————————————————————————————————————————————————

/** A wire, drawn as a dot. */
export interface HypergraphDot {
  /** The wire's id, `w<edge index>`. */
  id: string
  x: number
  y: number
  /** The underlying edge's kind, so an H-wire stays distinguishable. */
  kind: DiagramEdgeKind
  /** What a selection names this dot by — the ZX edge it stands for, when the
   *  hypergraph came from a diagram. Carried so a selection can be stated in
   *  the diagram's own terms, the language the other view reads, rather than in
   *  wire ids. */
  edge: number
  /** The two hyperedges holding it, by their own selection ids — the ZX nodes
   *  its edge runs between. A wire held by a single hyperedge end has that one
   *  in both, so a boundary leg whose boundary blob isn't drawn reads here the
   *  way a self-loop does. Nothing downstream tells the two apart; what does is
   *  the drawing, and only when the boundary blobs are on. */
  src: number
  tgt: number
}

/** A hyperedge, drawn as a shape enclosing the dots of its wires. */
export interface HypergraphBlob {
  /** The hyperedge's id, `e<node id>`. */
  id: string
  /** The ZX node it stands for — what a selection of this blob names in the
   *  diagram's own terms. */
  nodeId: number
  /** What the node is, without its phase: `Z`, `X`, `H`, or `in`/`out` for a
   *  boundary. This is the half `show-labels` governs. */
  name: string
  /** The phase on its own, e.g. `π/2` — drawn in the diagram view's blue, and
   *  drawn whether labels are on or off. Empty when the node has no phase to
   *  show. */
  phase: string
  /** Which node it stands for, and so which palette entry it is painted
   *  with — the same one that node itself would be. */
  kind: HyperedgeKind
  /** Ids of the dots it encloses. Deduplicated, unlike the hyperedge's wire
   *  list — a self-loop is one dot, drawn once, which is why a self-loop's blob
   *  count is the one that differs from every other wire's. A boundary encloses
   *  a single dot, so its outline is a circle. */
  dots: string[]
}

export interface HypergraphScene {
  dots: HypergraphDot[]
  blobs: HypergraphBlob[]
  width: number
  height: number
  /** Pixels per row/qubit of the ZX layout the dots were derived from. */
  scale: number
  /** Radius of a dot. */
  dotSize: number
  /** How far a blob's outline stands off the dots it encloses. */
  blobRadius: number
}
