import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect } from 'storybook/test'
import { type DiagramData, ORIGINAL_COLORS } from '../src/index'
import { singleZSpider, zHHzChain } from './diagrams'
import { shadowRootOf, translateOf, waitForNodes } from './interactionHelpers'

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

// The at-rest layout behind the two H-box chain-clamp drag stories. H-boxes
// carry no row of their own: the viewer parks a chain of them on the line
// between its two non-H-box endpoints, evenly spaced at lineParam
// (i + 1) / (n + 1) — so 1/3 and 2/3 for a pair.
//
// This is the baseline the drag clamp has to preserve. At rest the boxes are a
// third of the chain apart and comfortably clear; it is only the clamp's
// margin, which is a fraction of the chain rather than a pixel distance, that
// lets a dragged box come to rest on top of its neighbour.
export const ChainedHboxes: Story = {
  name: '8. Chained H-boxes',
  args: { diagram: zHHzChain },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    const spiders = await waitForNodes(root, 'circle', ORIGINAL_COLORS.Z, 2)
    const hboxes = await waitForNodes(root, 'rect', ORIGINAL_COLORS.H, 2)

    const [[ax, ay], [bx, by]] = spiders.map(translateOf)
    const [[h1x, h1y], [h2x, h2y]] = hboxes.map(translateOf)

    // Both boxes sit on the segment joining the two Z spiders...
    expect(ay).toBeCloseTo(by, 5)
    expect(h1y).toBeCloseTo(ay, 5)
    expect(h2y).toBeCloseTo(ay, 5)

    // ...evenly spaced, so the three gaps along it are equal.
    const span = bx - ax
    expect(h1x - ax).toBeCloseTo(span / 3, 5)
    expect(h2x - h1x).toBeCloseTo(span / 3, 5)
    expect(bx - h2x).toBeCloseTo(span / 3, 5)

    // ...and far enough apart to not paint over each other. Whatever the drag
    // clamp ends up enforcing, it should never leave less room than this.
    const boxWidth = Number(hboxes[0].querySelector('rect')?.getAttribute('width'))
    expect(h2x - h1x).toBeGreaterThanOrEqual(boxWidth)
  },
}

export const RenderErrorPath: Story = {
  name: '9. Render error path',
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
