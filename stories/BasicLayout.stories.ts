import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import type { DiagramData } from '../src/zxRender'
import { singleZSpider } from './diagrams'

interface Args {
  diagram: DiagramData
}

const meta: Meta<Args> = {
  title: 'Basic layout (adj list)',
  render: ({ diagram }) =>
    html`<zx-diagram .diagram=${diagram} style="min-height: 120px"></zx-diagram>`,
  parameters: {
    docs: {
      description: {
        component:
          'BFS auto-layout: leave `col`/`qubit` off and layout is derived from the input side.',
      },
    },
  },
}

export default meta

type Story = StoryObj<Args>

export const IdentityWire: Story = {
  name: '1. Identity wire',
  args: {
    diagram: {
      nodes: [
        { id: 0, type: 'input', ioId: 0 },
        { id: 1, type: 'output', ioId: 0 },
      ],
      edges: [{ src: 0, tgt: 1 }],
    },
  },
}

export const SingleZSpider: Story = {
  name: '2. Single Z spider with a phase',
  args: { diagram: singleZSpider },
}

export const BellStatePrep: Story = {
  name: '3. Bell-state preparation',
  args: {
    diagram: {
      nodes: [
        { id: 0, type: 'input', ioId: 0 },
        { id: 1, type: 'input', ioId: 1 },
        { id: 2, type: 'spider', color: 'Z', phase: '0' },
        { id: 3, type: 'spider', color: 'X', phase: '0' },
        { id: 4, type: 'hadamard' },
        { id: 5, type: 'output', ioId: 0 },
        { id: 6, type: 'output', ioId: 1 },
      ],
      edges: [
        { src: 0, tgt: 2 },
        { src: 1, tgt: 3 },
        { src: 2, tgt: 3 },
        { src: 2, tgt: 4 },
        { src: 4, tgt: 5 },
        { src: 3, tgt: 6 },
      ],
    },
  },
}

export const TwoSpiderFusion: Story = {
  name: '4. Two-spider fusion candidate',
  args: {
    diagram: {
      nodes: [
        { id: 0, type: 'input', ioId: 0 },
        { id: 1, type: 'spider', color: 'Z', phase: 'π/4' },
        { id: 2, type: 'spider', color: 'Z', phase: 'π/4' },
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

export const ParallelEdges: Story = {
  name: '5. Parallel edges',
  args: {
    diagram: {
      nodes: [
        { id: 0, type: 'input', ioId: 0 },
        { id: 1, type: 'spider', color: 'Z', phase: '0' },
        { id: 2, type: 'spider', color: 'X', phase: '0' },
        { id: 3, type: 'output', ioId: 0 },
      ],
      edges: [
        { src: 0, tgt: 1 },
        { src: 1, tgt: 2 },
        { src: 1, tgt: 2 },
        { src: 2, tgt: 3 },
      ],
    },
  },
}

export const SymbolicPhaseLabel: Story = {
  name: '6. Symbolic phase label',
  args: {
    diagram: {
      nodes: [
        { id: 0, type: 'input', ioId: 0 },
        { id: 1, type: 'spider', color: 'Z', phase: '0' },
        { id: 2, type: 'output', ioId: 0 },
      ],
      edges: [
        { src: 0, tgt: 1 },
        { src: 1, tgt: 2 },
      ],
      labels: [[1, 'α + π/2']],
    },
  },
}

export const RenderErrorPath: Story = {
  name: '7. Render error path',
  parameters: {
    docs: {
      description: {
        story: 'A malformed diagram (`nodes` missing) triggers the error UI with a Retry button.',
      },
    },
  },
  args: {
    diagram: { edges: [] } as unknown as DiagramData,
  },
}
