import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect } from 'storybook/test'
import { COLORS, type DiagramData } from '../src/zxRender'
import { shadowRootOf } from './interactionHelpers'

interface Args {
  diagram: DiagramData
}

const meta: Meta<Args> = {
  title: 'Advanced features',
  render: ({ diagram }) =>
    html`<zx-diagram .diagram=${diagram} style="min-height: 160px"></zx-diagram>`,
  parameters: {
    docs: {
      description: {
        component:
          'Shapes and annotations beyond plain Z/X spiders: W-input/W-output pairs, the Z-box, Hadamard edges (as blue line rather than yellow H-box), and Pauli-web strands overlaid on edges.',
      },
    },
  },
}

export default meta

type Story = StoryObj<Args>

// W-input (small black circle) → W-output (black triangle). In pyzx these
// always come in pairs joined by a W_IO edge, which paints gray rather than
// black to distinguish the internal connector from an ordinary wire.
export const WInputOutputPair: Story = {
  name: 'W-input / W-output pair',
  args: {
    diagram: {
      nodes: [
        { id: 0, type: 'input', ioId: 0 },
        { id: 1, type: 'w-input' },
        { id: 2, type: 'w-output' },
        { id: 3, type: 'output', ioId: 0 },
      ],
      edges: [
        { src: 0, tgt: 1 },
        { src: 1, tgt: 2, kind: 'w-io' },
        { src: 2, tgt: 3 },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    const strokes = [...root.querySelectorAll('svg g.link path')].map(p => p.getAttribute('stroke'))
    // The connector is gray (Xedge); the ordinary wires either side are black.
    expect(strokes).toEqual([COLORS.edge, COLORS.Xedge, COLORS.edge])
  },
}

// Z-box (green square) with a phase label. Rendered as a rect like the
// H-box but with the Zalt colour.
export const ZBox: Story = {
  name: 'Z-box with phase',
  args: {
    diagram: {
      nodes: [
        { id: 0, type: 'input', ioId: 0 },
        { id: 1, type: 'z-box', phase: 'π/4' },
        { id: 2, type: 'output', ioId: 0 },
      ],
      edges: [
        { src: 0, tgt: 1 },
        { src: 1, tgt: 2 },
      ],
    },
  },
}

// Hadamard edge: blue line between two Z spiders. Semantically equivalent
// to a hadamard node on the wire, but drawn without an intermediate box.
export const HadamardEdge: Story = {
  name: 'Hadamard edge (blue)',
  args: {
    diagram: {
      nodes: [
        { id: 0, type: 'input', ioId: 0 },
        { id: 1, type: 'spider', color: 'Z', phase: '0' },
        { id: 2, type: 'spider', color: 'Z', phase: '0' },
        { id: 3, type: 'output', ioId: 0 },
      ],
      edges: [
        { src: 0, tgt: 1 },
        { src: 1, tgt: 2, kind: 'hadamard' },
        { src: 2, tgt: 3 },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    const strokes = [...root.querySelectorAll('svg g.link path')].map(p => p.getAttribute('stroke'))
    expect(strokes).toEqual([COLORS.edge, COLORS.Hedge, COLORS.edge])
  },
}

// Pauli web: coloured strands overlaid on edges to visualise error
// propagation. X = pink, Y = light blue, Z = dark green, I = grey.
export const PauliWeb: Story = {
  name: 'Pauli-web overlay',
  args: {
    diagram: {
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
    },
  },
}
