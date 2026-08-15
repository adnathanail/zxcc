import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect } from 'storybook/test'
import type { DiagramData } from '../src/zxRender'
import { singleZSpider } from './diagrams'
import { shadowRootOf, translateOf } from './interactionHelpers'

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
  // Guards the canvas padding: pyzx offset nodes 2*scale from the top but only
  // 1*scale from the bottom, leaving a conspicuous empty band above every
  // diagram. Padding should match the 1*scale used either side horizontally.
  //
  // This diagram carries no `scalar`, so the equal top/bottom padding also
  // pins down that no scalar strip is reserved when there is nothing to show.
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    const svg = root.querySelector<SVGSVGElement>('svg')
    if (!svg) throw new Error('svg not found')

    const nodes = [...svg.querySelectorAll<SVGGElement>('g.node g')].map(translateOf)
    const ys = nodes.map(([, y]) => y)
    const xs = nodes.map(([x]) => x)
    const height = Number(svg.getAttribute('height'))
    const width = Number(svg.getAttribute('width'))

    const padTop = Math.min(...ys)
    const padBottom = height - Math.max(...ys)
    const padLeft = Math.min(...xs)
    const padRight = width - Math.max(...xs)

    expect(padTop).toBeCloseTo(padBottom, 1)
    expect(padTop).toBeCloseTo(padLeft, 1)
    expect(padLeft).toBeCloseTo(padRight, 1)

    // The scalar is the only direct <text> child of the <svg> — node phases and
    // labels live inside their node groups. Omitting `scalar` draws nothing.
    expect(svg.querySelectorAll(':scope > text').length).toBe(0)
  },
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
