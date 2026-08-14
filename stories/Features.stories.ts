import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import type { DiagramData } from '../src/zxRender'

interface Args {
  diagram: DiagramData
}

const meta: Meta<Args> = {
  title: 'Features',
  render: ({ diagram }) =>
    html`<zx-diagram .diagram=${diagram} style="min-height: 160px"></zx-diagram>`,
  parameters: {
    docs: {
      description: {
        component:
          'Shapes beyond plain Z/X spiders: W-input/W-output pairs, the Z-box, and Hadamard edges (as blue line rather than yellow H-box).',
      },
    },
  },
}

export default meta

type Story = StoryObj<Args>

// W-input (small black circle) → W-output (black triangle). In pyzx these
// always come in pairs joined by a single edge; the pair together acts as
// the W-spider generator.
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
        { src: 1, tgt: 2 },
        { src: 2, tgt: 3 },
      ],
    },
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
        { src: 1, tgt: 2, hadamard: true },
        { src: 2, tgt: 3 },
      ],
    },
  },
}
