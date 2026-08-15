// Turns a `DiagramData` into a pixel-space `Scene`: assigns each node a
// column/qubit (BFS from the inputs, unless the diagram arrives
// pre-positioned), scales that grid to pixels, reserves the strip the scalar
// sits in, and annotates parallel edges so the viewer can fan them into arcs.
//
// Pure and DOM-free — the TypeScript successor to the old zxRender.py that
// ran pyzx under Pyodide.

import type {
  DiagramData,
  DiagramEdge,
  LayoutOptions,
  NodeKind,
  Scene,
  SceneBox,
  SceneLink,
  SceneNode,
  SceneWeb,
} from './types'

/** Bounds on the derived scale, and the width it aims for. An explicit
 *  `scale` bypasses all three. */
const MAX_SCALE = 50
const MIN_SCALE = 20
const TARGET_WIDTH = 800

/** Scalar placement, in px from the bottom edge of the diagram box. */
const SCALAR_BASELINE_GAP = 0
const SCALAR_BOTTOM_MARGIN = 30

interface PlacedNode {
  id: number
  kind: NodeKind
  row: number | null
  qubit: number | null
  text: string
  isInput: boolean
  isOutput: boolean
  ground: boolean
  vdata: [string, unknown][]
}

function placeNodes(diagram: DiagramData): Map<number, PlacedNode> {
  const out = new Map<number, PlacedNode>()
  for (const n of diagram.nodes) {
    let kind: NodeKind = 'boundary'
    let text = ''
    let isInput = false
    let isOutput = false

    switch (n.type) {
      case 'input':
        isInput = true
        break
      case 'output':
        isOutput = true
        break
      case 'spider':
        kind = n.color === 'X' ? 'x-spider' : 'z-spider'
        text = n.phase ?? ''
        break
      case 'hadamard': {
        kind = 'hadamard'
        // The default H-box phase (π) renders no text — pyzx convention.
        const raw = n.phase ?? 'π'
        text = raw === 'π' ? '' : raw
        break
      }
      // `wire` predates the W-input concept and shares its rendering
      // (small black circle); kept as an alias for backward compatibility.
      case 'wire':
      case 'w-input':
        kind = 'w-input'
        break
      case 'w-output':
        kind = 'w-output'
        break
      case 'z-box':
        kind = 'z-box'
        text = n.phase ?? ''
        break
    }

    // Boundaries fall back to their io index for the qubit row, and to the
    // ends of the diagram for the column; everything else is left unplaced
    // for autoLayout unless the diagram supplied coordinates.
    let row = n.col ?? null
    let qubit = n.qubit ?? null
    if (isInput) {
      row = n.col ?? 0
      qubit = n.qubit ?? n.ioId ?? 0
    } else if (isOutput) {
      row = n.col ?? -1
      qubit = n.qubit ?? n.ioId ?? 0
    }

    out.set(n.id, {
      id: n.id,
      kind,
      row,
      qubit,
      text,
      isInput,
      isOutput,
      ground: n.ground ?? false,
      vdata: n.vdata ?? [],
    })
  }

  for (const [id, label] of diagram.labels ?? []) {
    const n = out.get(id)
    if (n) n.text = label
  }
  return out
}

/** BFS from the inputs: column = hop count, qubit = lowest free slot in that
 *  column. H-boxes are left unplaced — the viewer derives their position
 *  from their neighbours. */
function autoLayout(nodes: Map<number, PlacedNode>, edges: DiagramEdge[]): void {
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

  const laidOut = (n: PlacedNode) => !n.isInput && !n.isOutput && n.kind !== 'hadamard'

  for (const [id, d] of depth) {
    const n = nodes.get(id)
    if (n && laidOut(n)) n.row = d
  }
  for (const id of outputs) {
    const n = nodes.get(id)
    if (n) n.row = maxDepth
  }

  // Qubit assignment: fill the lowest free slot per column, skipping indices
  // already claimed by boundary nodes in that column.
  const rowTaken = new Map<number, Set<number>>()
  for (const id of [...inputs, ...outputs]) {
    const n = nodes.get(id)
    if (!n || n.row === null || n.qubit === null) continue
    let taken = rowTaken.get(n.row)
    if (!taken) {
      taken = new Set()
      rowTaken.set(n.row, taken)
    }
    taken.add(n.qubit)
  }

  const rowCounts = new Map<number, number>()
  // Iterate in id order (matches pyzx's GraphS.vertices() ordering).
  for (const id of [...nodes.keys()].sort((a, b) => a - b)) {
    const n = nodes.get(id)
    if (!n || !laidOut(n) || n.row === null) continue
    let count = rowCounts.get(n.row) ?? 0
    const taken = rowTaken.get(n.row) ?? new Set<number>()
    while (taken.has(count)) count++
    n.qubit = count
    rowCounts.set(n.row, count + 1)
  }
}

/** Bounds over placed nodes only — H-boxes carry no grid position. */
function gridBounds(nodes: Iterable<PlacedNode>) {
  let minRow = Number.POSITIVE_INFINITY
  let maxRow = Number.NEGATIVE_INFINITY
  let minQubit = Number.POSITIVE_INFINITY
  let maxQubit = Number.NEGATIVE_INFINITY
  for (const n of nodes) {
    if (n.row === null || n.qubit === null) continue
    if (n.row < minRow) minRow = n.row
    if (n.row > maxRow) maxRow = n.row
    if (n.qubit < minQubit) minQubit = n.qubit
    if (n.qubit > maxQubit) maxQubit = n.qubit
  }
  if (!Number.isFinite(minRow)) return { minRow: 0, maxRow: 0, minQubit: 0, maxQubit: 0 }
  return { minRow, maxRow, minQubit, maxQubit }
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/** Group edges by unordered endpoint pair so (a,b) and (b,a) count as
 *  parallel. Mirrors pyzx.drawing.graph_json's index/num_parallel. */
function buildLinks(edges: DiagramEdge[]): SceneLink[] {
  const counts = new Map<string, number>()
  const keys: string[] = []
  const links = edges.map(e => {
    const key = pairKey(e.src, e.tgt)
    const index = counts.get(key) ?? 0
    counts.set(key, index + 1)
    keys.push(key)
    return {
      source: e.src,
      target: e.tgt,
      kind: e.kind ?? 'simple',
      index,
      parallel: 0,
    }
  })
  for (let i = 0; i < links.length; i++) links[i].parallel = counts.get(keys[i]) ?? 1
  return links
}

export function layout(diagram: DiagramData, options: LayoutOptions = {}): Scene {
  const placed = placeNodes(diagram)
  const prePositioned = diagram.nodes.some(n => n.col !== undefined)
  if (!prePositioned) autoLayout(placed, diagram.edges)

  const { minRow, maxRow, minQubit, maxQubit } = gridBounds(placed.values())

  // An explicit scale is taken verbatim — the 20–50 clamp exists to keep the
  // derived scale sane, and would silently override a caller's choice.
  const derived = TARGET_WIDTH / (maxRow - minRow + 2)
  const scale = options.scale ?? Math.min(MAX_SCALE, Math.max(MIN_SCALE, derived))
  const nodeSize = Math.max(0.2 * scale, 2)

  // One scale of padding on every side, so the diagram sits centred in its
  // canvas. `topPad` is named separately because it also shifts the nodes.
  const topPad = scale
  const width = (maxRow - minRow + 2) * scale
  const diagramHeight = topPad + (maxQubit - minQubit) * scale + scale

  const scalar = diagram.scalar ?? ''
  const scalarY = diagramHeight + SCALAR_BASELINE_GAP
  const height = diagramHeight + (scalar !== '' ? SCALAR_BASELINE_GAP + SCALAR_BOTTOM_MARGIN : 0)

  // Emit in id order. H-boxes have no grid position and land at the
  // top-left placeholder; the viewer repositions them before the first paint.
  const nodes: SceneNode[] = [...placed.keys()]
    .sort((a, b) => a - b)
    .map(id => {
      const n = placed.get(id) as PlacedNode
      return {
        id: n.id,
        kind: n.kind,
        x: ((n.row ?? 0) - minRow + 1) * scale,
        y: topPad + ((n.qubit ?? 0) - minQubit) * scale,
        text: n.text,
        ground: n.ground,
        vdata: n.vdata,
      }
    })

  // Sort largest-first (id count is a proxy for area, since parents strictly
  // contain children) so outer boxes paint behind inner ones.
  const boxes: SceneBox[] = (diagram.boxes ?? [])
    .map(b => ({ kind: b.kind, nodeIds: b.nodeIds }))
    .sort((a, b) => b.nodeIds.length - a.nodeIds.length)

  const webs: SceneWeb[] = (diagram.pauliWeb ?? []).map(w => ({
    source: w.src,
    target: w.tgt,
    kind: w.kind,
  }))

  return {
    nodes,
    links: buildLinks(diagram.edges),
    webs,
    boxes,
    width,
    height,
    scale,
    nodeSize,
    autoHbox: !prePositioned,
    scalar,
    scalarY,
  }
}
