import type { DiagramData, DiagramEdge, DiagramNode } from '../src/index'

// Reusable diagrams for stories. Each is a wire (input→…→output) chain.

// input → Z(π/2) → output
export const singleZSpider: DiagramData = {
  nodes: [
    { id: 0, type: 'input', ioId: 0 },
    { id: 1, type: 'spider', color: 'Z', phase: 'π/2' },
    { id: 2, type: 'output', ioId: 0 },
  ],
  edges: [
    { src: 0, tgt: 1 },
    { src: 1, tgt: 2 },
  ],
}

// input → Z(0) → X(0) → output
export const zxSpiders: DiagramData = {
  nodes: [
    { id: 0, type: 'input', ioId: 0 },
    { id: 1, type: 'spider', color: 'Z', phase: '0' },
    { id: 2, type: 'spider', color: 'X', phase: '0' },
    { id: 3, type: 'output', ioId: 0 },
  ],
  edges: [
    { src: 0, tgt: 1 },
    { src: 1, tgt: 2 },
    { src: 2, tgt: 3 },
  ],
}

// One spider carrying a single self-loop wired to one carrying two. A lone
// loop uses the fixed ±40 control points; a second loop on the same node is
// spread by parallel-edge index so the two arcs stay distinct.
export const selfLoopSpiders: DiagramData = {
  nodes: [
    { id: 0, type: 'input', ioId: 0 },
    { id: 1, type: 'spider', color: 'Z', phase: '0' },
    { id: 2, type: 'spider', color: 'X', phase: '0' },
    { id: 3, type: 'output', ioId: 0 },
  ],
  edges: [
    { src: 0, tgt: 1 },
    { src: 1, tgt: 1 },
    { src: 1, tgt: 2 },
    { src: 2, tgt: 2 },
    { src: 2, tgt: 2 },
    { src: 2, tgt: 3 },
  ],
}

// input → Z(0) → H → Z(0) → output
export const zHzChain: DiagramData = {
  nodes: [
    { id: 0, type: 'input', ioId: 0 },
    { id: 1, type: 'spider', color: 'Z', phase: '0' },
    { id: 2, type: 'hadamard' },
    { id: 3, type: 'spider', color: 'Z', phase: '0' },
    { id: 4, type: 'output', ioId: 0 },
  ],
  edges: [
    { src: 0, tgt: 1 },
    { src: 1, tgt: 2 },
    { src: 2, tgt: 3 },
    { src: 3, tgt: 4 },
  ],
}

// input → Z(0) → H → H → Z(0) → output. Two chained H-boxes, so dragging one
// clamps against the other rather than against a chain endpoint.
export const zHHzChain: DiagramData = {
  nodes: [
    { id: 0, type: 'input', ioId: 0 },
    { id: 1, type: 'spider', color: 'Z', phase: '0' },
    { id: 2, type: 'hadamard' },
    { id: 3, type: 'hadamard' },
    { id: 4, type: 'spider', color: 'Z', phase: '0' },
    { id: 5, type: 'output', ioId: 0 },
  ],
  edges: [
    { src: 0, tgt: 1 },
    { src: 1, tgt: 2 },
    { src: 2, tgt: 3 },
    { src: 3, tgt: 4 },
    { src: 4, tgt: 5 },
  ],
}

// An H-box of degree 3. getHboxChainInfo() only resolves a chain for degree-2
// H-boxes, so this one falls back to the barycentre-plus-north-east-nudge
// placement instead.
export const hboxFanout: DiagramData = {
  nodes: [
    { id: 0, type: 'input', ioId: 0 },
    { id: 1, type: 'spider', color: 'Z', phase: '0' },
    { id: 2, type: 'spider', color: 'Z', phase: '0' },
    { id: 3, type: 'spider', color: 'Z', phase: '0' },
    { id: 4, type: 'hadamard' },
    { id: 5, type: 'output', ioId: 0 },
  ],
  edges: [
    { src: 0, tgt: 1 },
    { src: 1, tgt: 4 },
    { src: 2, tgt: 4 },
    { src: 3, tgt: 4 },
    { src: 3, tgt: 5 },
  ],
}

// Two degree-3 H-boxes over the *same* three spiders: their barycentres
// coincide, so the second one has to be nudged clear of the first.
export const hboxFanoutCollision: DiagramData = {
  nodes: [
    { id: 0, type: 'input', ioId: 0 },
    { id: 1, type: 'spider', color: 'Z', phase: '0' },
    { id: 2, type: 'spider', color: 'Z', phase: '0' },
    { id: 3, type: 'spider', color: 'Z', phase: '0' },
    { id: 4, type: 'hadamard' },
    { id: 5, type: 'hadamard' },
    { id: 6, type: 'output', ioId: 0 },
  ],
  edges: [
    { src: 0, tgt: 1 },
    { src: 1, tgt: 4 },
    { src: 2, tgt: 4 },
    { src: 3, tgt: 4 },
    { src: 1, tgt: 5 },
    { src: 2, tgt: 5 },
    { src: 3, tgt: 5 },
    { src: 3, tgt: 6 },
  ],
}

// Pauli-web strands overlaid on a Z–X–Z chain. Shared by the render story and
// the drag test that asserts strands follow their endpoints.
export const pauliWebChain: DiagramData = {
  nodes: [
    { id: 0, type: 'input', ioId: 0 },
    { id: 1, type: 'spider', color: 'Z', phase: '0' },
    { id: 2, type: 'spider', color: 'X', phase: '0' },
    { id: 3, type: 'spider', color: 'Z', phase: '0' },
    { id: 4, type: 'output', ioId: 0 },
  ],
  edges: [
    { src: 0, tgt: 1 },
    { src: 1, tgt: 2 },
    { src: 2, tgt: 3 },
    { src: 3, tgt: 4 },
  ],
  pauliWeb: [
    { src: 0, tgt: 1, kind: 'X' },
    { src: 1, tgt: 0, kind: 'X' },
    { src: 2, tgt: 1, kind: 'X' },
    { src: 1, tgt: 2, kind: 'Z' },
    { src: 2, tgt: 3, kind: 'Y' },
    { src: 3, tgt: 4, kind: 'I' },
  ],
}

// One diagram touching every palette key the viewer can paint: Z and X
// spiders, an H-box (H), a Z-box (Zalt), a W-input/W-output pair (W/Walt
// joined by a gray W_IO connector, Xedge), a Hadamard edge (Hedge), plain
// wires (edge), boundaries, and Pauli-web strands (Xdark/Ydark/Zdark). Used
// by the colour-scheme stories so that switching scheme visibly repaints
// something in every group.
export const paletteShowcase: DiagramData = {
  nodes: [
    { id: 0, type: 'input', ioId: 0 },
    { id: 1, type: 'spider', color: 'Z', phase: 'π/2' },
    { id: 2, type: 'spider', color: 'X', phase: 'π' },
    { id: 3, type: 'hadamard' },
    { id: 4, type: 'output', ioId: 0 },
    { id: 5, type: 'input', ioId: 1 },
    { id: 6, type: 'z-box', phase: 'π/4' },
    { id: 7, type: 'w-input' },
    { id: 8, type: 'w-output' },
    { id: 9, type: 'output', ioId: 1 },
  ],
  edges: [
    { src: 0, tgt: 1 },
    { src: 1, tgt: 2, kind: 'hadamard' },
    { src: 2, tgt: 3 },
    { src: 3, tgt: 4 },
    { src: 5, tgt: 6 },
    { src: 6, tgt: 7 },
    { src: 7, tgt: 8, kind: 'w-io' },
    { src: 8, tgt: 9 },
  ],
  pauliWeb: [
    { src: 1, tgt: 0, kind: 'X' },
    { src: 1, tgt: 2, kind: 'Z' },
    { src: 2, tgt: 1, kind: 'Y' },
  ],
}

// The characteristic 2-to-2 strong complementarity diagram: two Z spiders and
// two X spiders, each Z joined to each X. Pre-positioned, and the crossing
// edges make it the hardest case for the hypergraph view's hulls.
export const strongComplementarity: DiagramData = {
  nodes: [
    { id: 0, qubit: 0, col: 0, type: 'input', ioId: 0 },
    { id: 1, qubit: 0, col: 1, type: 'spider', color: 'Z' },
    { id: 2, qubit: 0, col: 2, type: 'spider', color: 'X' },
    { id: 3, qubit: 0, col: 3, type: 'output', ioId: 1 },
    { id: 4, qubit: 1, col: 0, type: 'input', ioId: 2 },
    { id: 5, qubit: 1, col: 1, type: 'spider', color: 'Z' },
    { id: 6, qubit: 1, col: 2, type: 'spider', color: 'X' },
    { id: 7, qubit: 1, col: 3, type: 'output', ioId: 3 },
  ],
  edges: [
    { src: 0, tgt: 1 },
    { src: 1, tgt: 2 },
    { src: 2, tgt: 3 },

    { src: 4, tgt: 5 },
    { src: 5, tgt: 6 },
    { src: 6, tgt: 7 },

    { src: 1, tgt: 6 },
    { src: 2, tgt: 5 },
  ],
}

// Four Z spiders in a square, each corner also carrying a boundary leg: eight
// wires, four hyperedges, and every dot shared by two of them.
export const fourSpiderSquare: DiagramData = {
  nodes: [
    { id: 0, type: 'input', ioId: 0 },
    { id: 1, type: 'input', ioId: 1 },
    { id: 2, type: 'spider', color: 'Z', phase: '0' },
    { id: 3, type: 'spider', color: 'Z', phase: '0' },
    { id: 4, type: 'spider', color: 'Z', phase: '0' },
    { id: 5, type: 'spider', color: 'Z', phase: '0' },
    { id: 6, type: 'output', ioId: 0 },
    { id: 7, type: 'output', ioId: 1 },
  ],
  edges: [
    { src: 0, tgt: 2 },
    { src: 1, tgt: 4 },
    { src: 2, tgt: 3 },
    { src: 2, tgt: 4 },
    { src: 3, tgt: 5 },
    { src: 4, tgt: 5 },
    { src: 3, tgt: 6 },
    { src: 5, tgt: 7 },
  ],
}

/**
 * The n-to-m strong complementarity diagram: every Z spider joined to every X
 * spider, each carrying a boundary leg of its own. `strongComplementarity`
 * above is the 2-to-2 case written out; this is the same shape at any size.
 *
 * It is the worst case for the hypergraph view by construction. Every Z—X wire
 * crosses every other, so the dots pile into the one column between the two
 * ranks, and every blob has to reach across that column past all the dots it
 * doesn't own.
 */
export function strongComplementarityOf(zCount: number, xCount: number): DiagramData {
  const input = (i: number) => i
  const z = (i: number) => zCount + i
  const x = (j: number) => 2 * zCount + j
  const output = (j: number) => 2 * zCount + xCount + j

  const nodes: DiagramNode[] = []
  const edges: DiagramEdge[] = []
  for (let i = 0; i < zCount; i++) {
    nodes.push({ id: input(i), type: 'input', ioId: i, col: 0, qubit: i })
    nodes.push({ id: z(i), type: 'spider', color: 'Z', col: 1, qubit: i })
    edges.push({ src: input(i), tgt: z(i) })
  }
  for (let j = 0; j < xCount; j++) {
    nodes.push({ id: x(j), type: 'spider', color: 'X', col: 2, qubit: j })
    nodes.push({ id: output(j), type: 'output', ioId: j, col: 3, qubit: j })
    edges.push({ src: x(j), tgt: output(j) })
  }
  for (let i = 0; i < zCount; i++) {
    for (let j = 0; j < xCount; j++) edges.push({ src: z(i), tgt: x(j) })
  }
  return { nodes, edges }
}
