import type { DiagramData } from '../src/zxRender'

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
