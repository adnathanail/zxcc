// Data contracts for the two stages of the pipeline:
//
//   DiagramData  --layout()-->  Scene  --<zx-viewer>-->  SVG
//
// `Diagram*` is the public input shape consumers hand to `<zx-diagram>`.
// `Scene*` is the laid-out, pixel-space result and is internal to the package.

// —————————————————————————————————————————————————————————————————————————
// Input
// —————————————————————————————————————————————————————————————————————————

export type DiagramNodeType =
  | 'spider'
  | 'input'
  | 'output'
  | 'hadamard'
  | 'wire'
  | 'w-input'
  | 'w-output'
  | 'z-box'

export interface DiagramNode {
  id: number
  type: DiagramNodeType
  color?: 'Z' | 'X'
  phase?: string
  ioId?: number
  /** Pre-computed column from the algebraic ZX walker. When present on
   *  any node, auto-layout is skipped — every node is expected to carry
   *  both `col` and `qubit`. */
  col?: number
  qubit?: number
  /** Grounded vertex (pyzx `Graph.is_ground`). Draws a stem and ground
   *  symbol hanging below the node. */
  ground?: boolean
  /** Extra `[key, value]` annotations drawn above the node, mirroring
   *  pyzx's `draw_d3(vdata=[...])`. Values are stringified via `join`. */
  vdata?: [string, unknown][]
}

/**
 * Edge kinds. The three named ones mirror pyzx's `EdgeType` and have a palette
 * colour each — `w-io` is the connector between a `w-input`/`w-output` pair and
 * renders gray.
 *
 * Any other string is a kind of your own. A kind is only ever a *colour*: it
 * picks which entry of `edgeColors` the wire (and the dot standing for it in
 * the hypergraph view) is painted with, and nothing in the layout or the
 * geometry reads it. So a custom kind needs no support here beyond a colour,
 * and one with no colour given simply draws like a plain wire. The literals are
 * kept in the union for autocomplete; `string & {}` is what stops TypeScript
 * collapsing the whole thing to `string` and losing them.
 */
export type DiagramEdgeKind = 'simple' | 'hadamard' | 'w-io' | (string & {})

export interface DiagramEdge {
  src: number
  tgt: number
  /** Render kind. A `hadamard` edge is semantically equivalent to inserting
   *  a `hadamard` node on the wire, but drawn as a coloured edge with no
   *  extra vertex. Defaults to `simple`. Any string is allowed — see
   *  {@link DiagramEdgeKind} — and colours come from `<zx-diagram>`'s
   *  `edgeColors`. */
  kind?: DiagramEdgeKind
}

export type PauliKind = 'X' | 'Y' | 'Z' | 'I'

/** A colored strand overlaid on the diagram, following pyzx's Pauli-web
 *  visualisation. Rendered as a thick coloured line from `src` to the
 *  midpoint of the (`src`, `tgt`) edge. */
export interface PauliWebLink {
  src: number
  tgt: number
  kind: PauliKind
}

export type BoxKind = 'stack' | 'compose'

/** The set of node ids inside a `stack` or `compose` subtree, emitted by
 *  the Lean walker. The viewer computes pixel bounds from each node's live
 *  position so boxes follow drags and don't extend into spliced-wire space. */
export interface DiagramBox {
  kind: BoxKind
  nodeIds: number[]
}

export interface DiagramData {
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  boxes?: DiagramBox[]
  /** Optional phase-label overrides keyed by node id. Used by tactics to
   *  display symbolic phases (variable names, `α + 1/2`, etc.) on
   *  parameterized diagrams in place of the placeholder `phase` field. */
  labels?: [number, string][]
  pauliWeb?: PauliWebLink[]
  /** Global scalar, pre-formatted (pyzx's `g.scalar.to_unicode()`). Painted
   *  below the diagram whenever present; omit the field to hide it. */
  scalar?: string
}

/** Per-call overrides for the otherwise-derived layout settings, mirroring
 *  the corresponding `pyzx.drawing.draw_d3` keyword arguments. */
export interface LayoutOptions {
  /** Pixels per row/qubit. When set, the derived scale and its 20–50 clamp
   *  are skipped entirely. */
  scale?: number
}

// —————————————————————————————————————————————————————————————————————————
// Laid-out scene
// —————————————————————————————————————————————————————————————————————————

/** How a node is drawn. Replaces pyzx's numeric `VertexType` — the viewer
 *  switches on these names rather than on 0..6. */
export type NodeKind =
  | 'boundary'
  | 'z-spider'
  | 'x-spider'
  | 'hadamard'
  | 'w-input'
  | 'w-output'
  | 'z-box'

export interface SceneNode {
  id: number
  kind: NodeKind
  /** Initial pixel position. The viewer treats this as the starting point
   *  and tracks drags separately, so re-layout resets positions. */
  x: number
  y: number
  /** Text drawn under the node: the phase, or the `labels` override when
   *  the diagram supplied one. Empty string means no text. */
  text: string
  ground: boolean
  vdata: [string, unknown][]
}

export interface SceneLink {
  source: number
  target: number
  kind: DiagramEdgeKind
  /** Position among the edges joining this same pair of nodes, and how many
   *  there are, so parallel edges fan out into distinct arcs. */
  index: number
  parallel: number
}

export interface SceneWeb {
  source: number
  target: number
  kind: PauliKind
}

export interface SceneBox {
  kind: BoxKind
  nodeIds: number[]
}

export interface Scene {
  nodes: SceneNode[]
  links: SceneLink[]
  webs: SceneWeb[]
  /** Sorted largest-first so outer boxes paint behind inner ones. Pixel
   *  bounds are computed by the viewer from live positions, so boxes follow
   *  drags. */
  boxes: SceneBox[]
  width: number
  height: number
  scale: number
  nodeSize: number
  /** Whether the viewer should position H-boxes from their neighbours.
   *  False when positions came pre-computed from the algebraic ZX walker —
   *  otherwise their supplied positions get overwritten on every paint. */
  autoHbox: boolean
  /** Pre-formatted global scalar, or `''` when the diagram carries none. */
  scalar: string
  /** Baseline for the scalar, inside the strip reserved below the diagram.
   *  Only meaningful when `scalar` is non-empty. */
  scalarY: number
}
