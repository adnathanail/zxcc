// TypeScript port of the former zxRender.py: builds a D3-ready graph object
// from the Lean diagram JSON, replacing pyzx + Pyodide.

export interface DiagramNode {
  id: number
  type: 'spider' | 'input' | 'output' | 'hadamard' | 'wire' | 'w-input' | 'w-output' | 'z-box'
  color?: 'Z' | 'X'
  phase?: string
  ioId?: number
  /** Pre-computed column from the algebraic ZX walker. When present on
   *  any node, autoLayout is skipped — every node is expected to carry
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

/** Edge kinds, mirroring pyzx's `EdgeType`. `w-io` is the connector between
 *  a `w-input`/`w-output` pair and renders gray. */
export type DiagramEdgeKind = 'simple' | 'hadamard' | 'w-io'

export interface DiagramEdge {
  src: number
  tgt: number
  /** Render kind. A `hadamard` edge is semantically equivalent to inserting
   *  a `hadamard` node on the wire, but drawn as a coloured edge with no
   *  extra vertex. Defaults to `simple`. */
  kind?: DiagramEdgeKind
}

/** A colored strand overlaid on the diagram, following pyzx's Pauli-web
 *  visualisation. Rendered as a thick coloured line from `src` to the
 *  midpoint of the (`src`, `tgt`) edge. */
export interface PauliWebLink {
  src: number
  tgt: number
  kind: 'X' | 'Y' | 'Z' | 'I'
}

/** The set of node ids inside a `stack` or `compose` subtree, emitted by
 *  the Lean walker. The viewer computes pixel bounds from each node's live
 *  position so boxes follow drags and don't extend into spliced-wire space. */
export interface DiagramBox {
  kind: 'stack' | 'compose'
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

export interface GraphNode {
  name: string
  x: number
  y: number
  t: number
  phase: string
  ground: boolean
  vdata: [string, unknown][]
}

export interface GraphLink {
  source: string
  target: string
  t: number
  index: number
  num_parallel: number
}

export interface PauliWebEntry {
  source: string
  target: string
  t: 'X' | 'Y' | 'Z' | 'I'
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
  pauli_web: PauliWebEntry[]
}

/** A box passed through to `zxViewer.js` unchanged; pixel bounds are
 *  computed there from live node positions so they follow drags. */
export interface RenderBox {
  kind: 'stack' | 'compose'
  nodeIds: number[]
}

export interface RenderData {
  graph: GraphData
  width: number
  height: number
  scale: number
  node_size: number
  colors: Record<string, string>
  /** Whether the viewer should auto-position H-boxes at the barycentre of
   *  their neighbours. False when positions came pre-computed from the
   *  algebraic ZX walker — otherwise hadamards' supplied positions get
   *  overwritten on every paint. */
  auto_hbox: boolean
  /** Bounding rectangles for `stack`/`compose` subtrees, sorted largest-area
   *  first so outer boxes paint behind inner ones. */
  boxes: RenderBox[]
  /** Phase-label overrides keyed by node id. The viewer renders these
   *  strings in place of the spider's parsed phase when present. */
  labels: Map<number, string>
  /** Pre-formatted global scalar, or `''` when the diagram carries none. */
  scalar_str: string
  /** Baseline for the scalar, inside the strip reserved below the diagram.
   *  Only meaningful when `scalar_str` is non-empty. */
  scalar_y: number
}

/** Per-call overrides for the otherwise-derived render settings, mirroring
 *  the corresponding `pyzx.drawing.draw_d3` keyword arguments. */
export interface RenderOptions {
  /** Palette to paint with. Defaults to {@link ORIGINAL_COLORS}. */
  colors?: Record<string, string>
}

const VertexType = {
  BOUNDARY: 0,
  Z: 1,
  X: 2,
  H_BOX: 3,
  W_INPUT: 4,
  W_OUTPUT: 5,
  Z_BOX: 6,
} as const
// `wire` predates the W-input concept and shares its rendering (small
// black circle); keep it as an alias for backward compatibility.
const WIRE = VertexType.W_INPUT
const EdgeType = { SIMPLE: 1, HADAMARD: 2, W_IO: 3 } as const

/** Scalar placement, in px from the bottom edge of the diagram box. */
const SCALAR_BASELINE_GAP = 0
const SCALAR_BOTTOM_MARGIN = 30

const EDGE_TYPE_OF: Record<DiagramEdgeKind, number> = {
  simple: EdgeType.SIMPLE,
  hadamard: EdgeType.HADAMARD,
  'w-io': EdgeType.W_IO,
}

// pyzx.utils.original_colors
export const ORIGINAL_COLORS: Record<string, string> = {
  edge: '#000000',
  Hedge: '#0088ff',
  Xedge: '#999999',
  boundary: '#000000',
  X: '#ff8888',
  Y: '#aabbff',
  Z: '#ccffcc',
  H: '#ffff66',
  W: '#000000',
  Zalt: '#ccffcc',
  Walt: '#000000',
  Xdark: '#ff8888',
  Ydark: '#aabbff',
  Zdark: '#99dd99',
}

// pyzx.utils.rgb_colors — original with Y/Z and Ydark/Zdark swapped and an
// orange Hadamard edge.
export const RGB_COLORS: Record<string, string> = {
  ...ORIGINAL_COLORS,
  Hedge: '#ff6600',
  Y: ORIGINAL_COLORS.Z,
  Z: ORIGINAL_COLORS.Y,
  Ydark: ORIGINAL_COLORS.Zdark,
  Zdark: ORIGINAL_COLORS.Ydark,
}

// pyzx.utils.grayscale_colors
export const GRAYSCALE_COLORS: Record<string, string> = {
  edge: '#000000',
  Hedge: '#888888',
  Xedge: '#dddddd',
  boundary: '#000000',
  X: '#666666',
  Y: '#9999dd',
  Z: '#dddddd',
  H: '#eeeeee',
  W: '#000000',
  Zalt: '#dddddd',
  Walt: '#000000',
  Xdark: '#666666',
  Ydark: '#9999dd',
  Zdark: '#dddddd',
}

export type ColorSchemeName = 'original' | 'rgb' | 'grayscale'

export const COLOR_SCHEMES: Record<ColorSchemeName, Record<string, string>> = {
  original: ORIGINAL_COLORS,
  rgb: RGB_COLORS,
  grayscale: GRAYSCALE_COLORS,
}

/** @deprecated use {@link ORIGINAL_COLORS}. */
export const COLORS = ORIGINAL_COLORS

// Phase strings now arrive pre-formatted from Lean (see `Phase.format` in
// LeanSpider/Visualize.lean) — e.g. `"π/2"`, `"-π/4"`, `"π"`, `"0"`. The
// widget passes them through verbatim; only the H-box default suppression
// remains (a Hadamard with the default phase `π` renders no text).

interface InternalNode {
  id: number
  t: number
  row: number | null
  qubit: number | null
  phaseStr: string
  isInput: boolean
  isOutput: boolean
  ground: boolean
  vdata: [string, unknown][]
}

function buildNodes(diagram: DiagramData): Map<number, InternalNode> {
  const out = new Map<number, InternalNode>()
  for (const n of diagram.nodes) {
    let t: number
    let row: number | null = null
    let qubit: number | null = null
    let phaseStr = ''
    let isInput = false
    let isOutput = false
    // Type-independent, so read once rather than in all eight branches.
    const ground = n.ground ?? false
    const vdata = n.vdata ?? []

    if (n.type === 'input') {
      t = VertexType.BOUNDARY
      row = n.col ?? 0
      qubit = n.qubit ?? n.ioId ?? 0
      isInput = true
    } else if (n.type === 'output') {
      t = VertexType.BOUNDARY
      row = n.col ?? -1
      qubit = n.qubit ?? n.ioId ?? 0
      isOutput = true
    } else if (n.type === 'spider') {
      t = n.color === 'X' ? VertexType.X : VertexType.Z
      if (n.col !== undefined) row = n.col
      if (n.qubit !== undefined) qubit = n.qubit
      phaseStr = n.phase ?? ''
    } else if (n.type === 'hadamard') {
      t = VertexType.H_BOX
      if (n.col !== undefined) row = n.col
      if (n.qubit !== undefined) qubit = n.qubit
      const raw = n.phase ?? 'π'
      // Default H-box phase (π) renders no text — matches pyzx convention.
      phaseStr = raw === 'π' ? '' : raw
    } else if (n.type === 'wire' || n.type === 'w-input') {
      t = WIRE
      if (n.col !== undefined) row = n.col
      if (n.qubit !== undefined) qubit = n.qubit
    } else if (n.type === 'w-output') {
      t = VertexType.W_OUTPUT
      if (n.col !== undefined) row = n.col
      if (n.qubit !== undefined) qubit = n.qubit
    } else if (n.type === 'z-box') {
      t = VertexType.Z_BOX
      if (n.col !== undefined) row = n.col
      if (n.qubit !== undefined) qubit = n.qubit
      phaseStr = n.phase ?? ''
    } else {
      t = VertexType.BOUNDARY
    }
    out.set(n.id, { id: n.id, t, row, qubit, phaseStr, isInput, isOutput, ground, vdata })
  }
  return out
}

function autoLayout(nodes: Map<number, InternalNode>, edges: DiagramEdge[]): void {
  const inputs: number[] = []
  const outputs: number[] = []
  for (const n of nodes.values()) {
    if (n.isInput) inputs.push(n.id)
    if (n.isOutput) outputs.push(n.id)
  }
  if (inputs.length === 0) return

  const adj = new Map<number, number[]>()
  for (const id of nodes.keys()) adj.set(id, [])
  for (const e of edges) {
    adj.get(e.src)?.push(e.tgt)
    adj.get(e.tgt)?.push(e.src)
  }

  // BFS depth from inputs
  const depth = new Map<number, number>()
  const queue: number[] = []
  for (const id of inputs) {
    depth.set(id, 0)
    queue.push(id)
  }
  while (queue.length) {
    const cur = queue.shift() as number
    const curDepth = depth.get(cur) ?? 0
    for (const nb of adj.get(cur) ?? []) {
      if (!depth.has(nb)) {
        depth.set(nb, curDepth + 1)
        queue.push(nb)
      }
    }
  }

  let maxDepth = 1
  for (const d of depth.values()) if (d > maxDepth) maxDepth = d

  // Assign rows: interior non-H-box vertices get BFS depth; outputs get maxDepth.
  // H-boxes get no row (positioned by auto_hbox in the viewer).
  for (const [id, d] of depth) {
    const n = nodes.get(id)
    if (!n) continue
    if (!n.isInput && !n.isOutput && n.t !== VertexType.H_BOX) {
      n.row = d
    }
  }
  for (const id of outputs) {
    const n = nodes.get(id)
    if (n) n.row = maxDepth
  }

  // Qubit assignment: interior non-H-box vertices fill the lowest free slot per
  // row, skipping qubit indices already claimed by boundary nodes on that row.
  const rowTaken = new Map<number, Set<number>>()
  const claim = (row: number, q: number) => {
    let s = rowTaken.get(row)
    if (!s) {
      s = new Set()
      rowTaken.set(row, s)
    }
    s.add(q)
  }
  for (const id of [...inputs, ...outputs]) {
    const n = nodes.get(id)
    if (n && n.row !== null && n.qubit !== null) claim(n.row, n.qubit)
  }

  const rowCounts = new Map<number, number>()
  // Iterate in id order (matches pyzx's GraphS.vertices() ordering).
  const sortedIds = [...nodes.keys()].sort((a, b) => a - b)
  for (const id of sortedIds) {
    const n = nodes.get(id)
    if (!n) continue
    if (n.isInput || n.isOutput || n.t === VertexType.H_BOX) continue
    if (n.row === null) continue
    let count = rowCounts.get(n.row) ?? 0
    const taken = rowTaken.get(n.row) ?? new Set<number>()
    while (taken.has(count)) count++
    n.qubit = count
    rowCounts.set(n.row, count + 1)
  }
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

export function render(diagram: DiagramData, options: RenderOptions = {}): RenderData {
  const nodes = buildNodes(diagram)
  const positioned = diagram.nodes.some(n => n.col !== undefined)
  if (!positioned) autoLayout(nodes, diagram.edges)

  // Skip H-boxes (no row/qubit) when computing the bounds.
  let minrow = Number.POSITIVE_INFINITY
  let maxrow = Number.NEGATIVE_INFINITY
  let minqub = Number.POSITIVE_INFINITY
  let maxqub = Number.NEGATIVE_INFINITY
  for (const n of nodes.values()) {
    if (n.row === null || n.qubit === null) continue
    if (n.row < minrow) minrow = n.row
    if (n.row > maxrow) maxrow = n.row
    if (n.qubit < minqub) minqub = n.qubit
    if (n.qubit > maxqub) maxqub = n.qubit
  }
  if (!Number.isFinite(minrow)) {
    minrow = 0
    maxrow = 0
    minqub = 0
    maxqub = 0
  }

  let scale = 800 / (maxrow - minrow + 2)
  if (scale > 50) scale = 50
  if (scale < 20) scale = 20

  // Pad width by 2 rows (why rows??)
  const width = (maxrow - minrow + 2) * scale
  const node_size = Math.max(0.2 * scale, 2)

  // Pad height by 2 qubits
  //   pulled out topPad into separate variable,
  //   in case we want to adjust it separately,
  //   as it should also then affect node positioning
  const topPad = scale
  const diagramHeight = topPad + (maxqub - minqub) * scale + scale

  // Work out scalar_y
  const scalar_str = diagram.scalar ?? ''
  const scalar_y = diagramHeight + SCALAR_BASELINE_GAP
  // Adjust svg height if scalar present
  const height =
    diagramHeight + (scalar_str !== '' ? SCALAR_BASELINE_GAP + SCALAR_BOTTOM_MARGIN : 0)

  // Emit nodes in id order. H-boxes without a row land at the top-left
  // placeholder coordinate; the viewer's update_hboxes() repositions them
  // before the first paint.
  const sortedIds = [...nodes.keys()].sort((a, b) => a - b)
  const outNodes: GraphNode[] = sortedIds.map(id => {
    const n = nodes.get(id) as InternalNode
    const row = n.row ?? 0
    const qubit = n.qubit ?? 0
    return {
      name: String(n.id),
      x: (row - minrow + 1) * scale,
      y: topPad + (qubit - minqub) * scale,
      t: n.t,
      phase: n.phaseStr,
      ground: n.ground,
      vdata: n.vdata,
    }
  })

  // Parallel edge metadata: group by unordered endpoint pair so (a,b) and (b,a)
  // count as parallel. Mirrors pyzx.drawing.graph_json's index/num_parallel.
  const counts = new Map<string, number>()
  const linkKeys: string[] = []
  const links: GraphLink[] = diagram.edges.map(e => {
    const k = pairKey(e.src, e.tgt)
    const i = counts.get(k) ?? 0
    counts.set(k, i + 1)
    linkKeys.push(k)
    return {
      source: String(e.src),
      target: String(e.tgt),
      t: e.kind ? EDGE_TYPE_OF[e.kind] : EdgeType.SIMPLE,
      index: i,
      num_parallel: 0,
    }
  })
  for (let i = 0; i < links.length; i++) {
    links[i].num_parallel = counts.get(linkKeys[i]) ?? 1
  }

  // Boxes pass through unchanged. Pixel bounds are computed in zxViewer.js
  // from live node positions. Sort largest first (id-count is a proxy for
  // area since parents strictly contain children) so outer paints behind.
  const boxes: RenderBox[] = (diagram.boxes ?? []).map(b => ({
    kind: b.kind,
    nodeIds: b.nodeIds,
  }))
  boxes.sort((a, b) => b.nodeIds.length - a.nodeIds.length)

  const labels = new Map<number, string>()
  for (const entry of diagram.labels ?? []) {
    labels.set(entry[0], entry[1])
  }

  const pauli_web: PauliWebEntry[] = (diagram.pauliWeb ?? []).map(w => ({
    source: String(w.src),
    target: String(w.tgt),
    t: w.kind,
  }))

  return {
    graph: { nodes: outNodes, links, pauli_web },
    width,
    height,
    scale,
    node_size,
    colors: options.colors ?? ORIGINAL_COLORS,
    auto_hbox: !positioned,
    boxes,
    labels,
    scalar_str,
    scalar_y,
  }
}
