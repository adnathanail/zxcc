import type { DiagramData } from '../zxRender'

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
