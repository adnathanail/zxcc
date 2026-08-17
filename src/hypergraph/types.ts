// Data contracts for the hypergraph view, the way `src/types.ts` holds the
// ones for the diagram itself:
//
//   DiagramData --toHypergraph()--> HypergraphData
//                --layoutHypergraph()--> HypergraphScene --<zx-hypergraph-viewer>--> SVG
//
// `Hypergraph{Wire,Edge,Data}` is the conversion's output: the dual as pure
// combinatorics, with no coordinates. `Hypergraph{Dot,Blob,Scene}` is that
// laid out in pixel space, and is internal to the package.

import type { DiagramEdgeKind, NodeKind } from '../types'

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
  /** The two joined, e.g. `Z(π/2)`, `X(0)`, `H` — the one-string form, for a
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
  /** The ZX endpoints the wire joins, e.g. `0—2`. */
  label: string
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
