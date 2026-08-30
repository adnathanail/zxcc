// Data contracts for the hypergraph view, the way `src/types.ts` holds the
// ones for the diagram itself. There are two ways to a `HypergraphScene`, one
// per way of saying what the hypergraph is:
//
//   DiagramData + Scene --toHypergraph()--> HypergraphData
//                        --layoutHypergraph()--> HypergraphScene
//   HypergraphInput      --manualScene()-->  HypergraphScene
//                        --<zx-hypergraph-viewer>--> SVG
//
// `HypergraphInput` is the public input shape a caller hands `<zx-hypergraph>`:
// the hypergraph written out directly, dots and all, rather than derived from a
// ZX diagram. `Hypergraph{Wire,Edge,Data}` is `toHypergraph`'s output — the
// dual of a diagram as pure combinatorics, with no coordinates.
// `Hypergraph{Dot,Blob,Scene}` is either of those laid out in pixel space, and
// is internal to the package.

import type { DiagramEdgeKind, NodeKind } from '../types'

// —————————————————————————————————————————————————————————————————————————
// Hand-written input
// —————————————————————————————————————————————————————————————————————————

/** A hypergraph node, drawn as a dot. It stands for a wire, which is what a ZX
 *  edge becomes in the dual, so it is one here too — `<zx-hypergraph-viewer>`
 *  paints it with an edge's colour and `show-labels` writes an edge's id under
 *  it. */
export interface HypergraphInputWire {
  /** Which grid square the dot goes in — the same grid `layout()` puts a ZX
   *  diagram on, one `scale` apart in either direction, and turned into pixels
   *  by `<zx-hypergraph>`'s `scale`. The grid is read relative to its own
   *  lowest column and qubit, so negative coordinates are fine, and fractional
   *  ones put a dot between two squares. */
  col: number
  qubit: number
  /** Which colour the dot takes, as a wire kind — `hadamard` for the blue an
   *  H-wire's dot is filled with, or a kind of your own named in
   *  `<zx-hypergraph>`'s `edgeColors`. Defaults to a plain wire. */
  kind?: DiagramEdgeKind
}

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
}

/**
 * A hypergraph written out directly, as `<zx-hypergraph>` takes it: the dots and
 * which grid square each goes in, and which of them each blob holds.
 *
 * Every wire is held by exactly two hyperedge ends — the two ZX nodes its edge
 * would run between, or one hyperedge twice for a self-loop, or a spider and a
 * boundary for a leg hanging out of the diagram. That is what makes this a ZX
 * diagram written the other way round rather than a hypergraph in general, and
 * `manualScene` checks it: a wire held by three is a picture the ZX half of the
 * package has no counterpart for, and a wire held by one has an end that is
 * nowhere.
 */
export interface HypergraphInput {
  wires: HypergraphInputWire[]
  hyperedges: HypergraphInputHyperedge[]
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
  /** Index of the ZX edge this dot stands for, and the nodes that edge joins.
   *  Carried so a selection can be stated in the diagram's own terms — the
   *  language the other view reads — rather than in wire ids. */
  edge: number
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
