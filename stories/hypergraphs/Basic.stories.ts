import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect, waitFor } from 'storybook/test'
import type { DiagramData } from '../../src/types'
import { strongComplementarity } from '../diagrams'
import { shadowRootOf } from '../interactionHelpers'

interface Args {
  diagram: DiagramData
  viewAsHypergraph: boolean
  showLabels: boolean
  colorScheme: 'original' | 'rgb' | 'grayscale'
}

const meta: Meta<Args> = {
  title: 'Hypergraphs/Basic',
  render: ({ diagram, viewAsHypergraph, showLabels, colorScheme }) =>
    html`<zx-diagram
      .diagram=${diagram}
      ?view-as-hypergraph=${viewAsHypergraph}
      show-labels=${showLabels ? 'true' : 'false'}
      color-scheme=${colorScheme}
      style="min-height: 160px"
    ></zx-diagram>`,
  argTypes: {
    viewAsHypergraph: { control: 'boolean' },
    showLabels: { control: 'boolean' },
    colorScheme: { control: 'select', options: ['original', 'rgb', 'grayscale'] },
  },
  args: { viewAsHypergraph: true, showLabels: true, colorScheme: 'original' },
  parameters: {
    docs: {
      description: {
        component:
          "With `view-as-hypergraph` set, the element draws the diagram's hypergraph dual: every ZX edge becomes a dot, and every non-boundary ZX node becomes a blob enclosing the dots of its incident wires. Dots sit at the midpoint of the edge they came from, so the two views line up — toggle the control to compare. A blob is filled with the same palette entry its spider would be, so `color-scheme` applies to both views.",
      },
    },
  },
}

export default meta

type Story = StoryObj<Args>

/** Each blob's caption, split into its `<tspan>` pieces — `Z(`, the phase, `)`
 *  — so the assertions can tell the grey name from the blue phase. */
const blobCaptions = (root: ParentNode) =>
  [...root.querySelectorAll('svg g.blob text')].map(t =>
    [...t.querySelectorAll('tspan')].map(s => s.textContent),
  )

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

    showLabels: true,
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
  // A blob's caption is `name(phase)`, and the phase half takes `<zx-viewer>`'s
  // blue so the same phase reads the same in either view.
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    await waitFor(() =>
      expect(blobCaptions(root)).toEqual([
        ['Z(', 'π/2', ')'],
        ['X(', '0', ')'],
      ]),
    )
    const phases = [...root.querySelectorAll('svg g.blob text tspan[fill="#00d"]')]
    expect(phases.map(t => t.textContent)).toEqual(['π/2', '0'])
  },
}

export const HadamardNode: Story = {
  name: '4. A Hadamard node',
  parameters: {
    docs: {
      story: {
        description:
          "An explicit `hadamard` node is a hyperedge of its own, and takes the palette's H colour. The layout leaves H-boxes unplaced, so its two dots sit either side of wherever `Topology` resolves it to — the same position `<zx-viewer>` would paint it at.",
      },
    },
  },
  args: {
    diagram: {
      nodes: [
        { id: 0, type: 'input', ioId: 0 },
        { id: 1, type: 'spider', color: 'Z', phase: '0' },
        { id: 2, type: 'hadamard' },
        { id: 3, type: 'spider', color: 'X', phase: 'π' },
        { id: 4, type: 'output', ioId: 0 },
      ],
      edges: [
        { src: 0, tgt: 1 },
        { src: 1, tgt: 2 },
        { src: 2, tgt: 3 },
        { src: 3, tgt: 4 },
      ],
    },
  },
}

export const StrongComplementarity: Story = {
  name: '5. Strong complementarity',
  parameters: {
    docs: {
      story: {
        description:
          'The characteristic 2 to 2 strong complementarity diagram, testing the hypergraph rendering of more difficult hulls.',
      },
    },
  },
  args: { diagram: strongComplementarity },
}

// Labels off hides the names, not the phases: a blob's `Z(π/2)` drops to
// `π/2`, and a node with no phase to show — a default-π Hadamard — loses its
// text altogether. This mirrors `<zx-viewer>`, where `show-labels` only ever
// governed the grey id text and the phase was always painted.
export const LabelsHidden: Story = {
  name: '6. Labels hidden',
  args: {
    showLabels: false,
    diagram: {
      nodes: [
        { id: 0, type: 'input', ioId: 0 },
        { id: 1, type: 'spider', color: 'Z', phase: 'π/2' },
        { id: 2, type: 'hadamard' },
        { id: 3, type: 'spider', color: 'X', phase: '0' },
        { id: 4, type: 'output', ioId: 0 },
      ],
      edges: [
        { src: 0, tgt: 1 },
        { src: 1, tgt: 2 },
        { src: 2, tgt: 3 },
        { src: 3, tgt: 4 },
      ],
    },
  },
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    // The Z spider keeps its phase, the X spider its `0`, and both are still
    // blue; the names and the parens around them went with the labels. The
    // default-π Hadamard has no phase to show, so its blob goes uncaptioned.
    await waitFor(() => expect(blobCaptions(root)).toEqual([['π/2'], ['0']]))
    const phases = [...root.querySelectorAll('svg g.blob text tspan[fill="#00d"]')]
    expect(phases.length).toBe(2)
    // The wire ids are the other thing that went away.
    expect(root.querySelectorAll('svg g.dot text').length).toBe(0)
  },
}

export const UnsupportedNodeType: Story = {
  name: '7. Node type with no blob',
  parameters: {
    docs: {
      story: {
        description:
          'Only spiders and Hadamards have a blob shape. A W, Z-box or `wire` node would be a hyperedge in the dual, but there is no agreed way to draw one, so `toHypergraph` rejects the diagram rather than picking a colour. `<zx-diagram>` shows the message in its error state; drop `view-as-hypergraph` and the same diagram draws fine.',
      },
    },
  },
  args: {
    diagram: {
      nodes: [
        { id: 0, type: 'input', ioId: 0 },
        { id: 1, type: 'spider', color: 'Z', phase: '0' },
        { id: 2, type: 'z-box', phase: '2' },
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
