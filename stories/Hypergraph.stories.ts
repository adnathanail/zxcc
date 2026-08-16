import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import type { DiagramData } from '../src/types'

interface Args {
  diagram: DiagramData
  viewAsHypergraph: boolean
  showLabels: boolean
}

const meta: Meta<Args> = {
  title: 'Hypergraph view',
  render: ({ diagram, viewAsHypergraph, showLabels }) =>
    html`<zx-diagram
      .diagram=${diagram}
      ?view-as-hypergraph=${viewAsHypergraph}
      show-labels=${showLabels ? 'true' : 'false'}
      style="min-height: 160px"
    ></zx-diagram>`,
  argTypes: {
    viewAsHypergraph: { control: 'boolean' },
    showLabels: { control: 'boolean' },
  },
  args: { viewAsHypergraph: true, showLabels: true },
  parameters: {
    docs: {
      description: {
        component:
          "With `view-as-hypergraph` set, the element draws the diagram's hypergraph dual: every ZX edge becomes a dot, and every non-boundary ZX node becomes a blob enclosing the dots of its incident wires. Dots sit at the midpoint of the edge they came from, so the two views line up — toggle the control to compare.",
      },
    },
  },
}

export default meta

type Story = StoryObj<Args>

export const TwoSpiders: Story = {
  name: '1. Two spiders, three wires',
  parameters: {
    docs: {
      description: {
        story:
          'The smallest interesting case: three dots, and two blobs sharing the dot for the wire between the spiders.',
      },
    },
  },
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
        { src: 1, tgt: 2 },
        { src: 2, tgt: 3 },
      ],
    },
  },
}

export const FourSpiderSquare: Story = {
  name: '2. Four spiders, eight wires',
  args: {
    diagram: {
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
    },
  },
}

export const HadamardAndParallelEdges: Story = {
  name: '3. H-edges and parallel edges',
  parameters: {
    docs: {
      description: {
        story:
          'Parallel edges stay distinct wires — two dots, fanned apart the way the arcs they came from are — and a Hadamard edge is flagged on the wire rather than becoming its own hyperedge.',
      },
    },
  },
  args: {
    diagram: {
      nodes: [
        { id: 0, type: 'input', ioId: 0 },
        { id: 1, type: 'spider', color: 'Z', phase: 'π/2' },
        { id: 2, type: 'spider', color: 'X', phase: '0' },
        { id: 3, type: 'output', ioId: 0 },
      ],
      edges: [
        { src: 0, tgt: 1 },
        { src: 1, tgt: 2 },
        { src: 1, tgt: 2, kind: 'hadamard' },
        { src: 2, tgt: 3 },
      ],
    },
  },
}
