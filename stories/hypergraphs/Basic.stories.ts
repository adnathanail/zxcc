import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect, waitFor } from 'storybook/test'
import type { ViewMode } from '../../src/index'
import type { DiagramData } from '../../src/types'
import { fourSpiderSquare, strongComplementarityOf } from '../diagrams'
import { shadowRootOf } from '../interactionHelpers'

interface Args {
  diagram: DiagramData
  viewMode: ViewMode
  showLabels: boolean
  colorScheme: 'original' | 'rgb' | 'grayscale'
}

const renderDiagram = ({ diagram, viewMode, showLabels, colorScheme }: Args) =>
  html`<zx-diagram
    .diagram=${diagram}
    view-mode=${viewMode}
    show-labels=${showLabels ? 'true' : 'false'}
    color-scheme=${colorScheme}
    style="min-height: 160px"
  ></zx-diagram>`

const meta: Meta<Args> = {
  title: 'Hypergraphs/Basic',
  render: renderDiagram,
  argTypes: {
    viewMode: { control: 'inline-radio', options: ['graph', 'hypergraph', 'both'] },
    showLabels: { control: 'boolean' },
    colorScheme: { control: 'select', options: ['original', 'rgb', 'grayscale'] },
  },
  args: { viewMode: 'hypergraph', showLabels: true, colorScheme: 'original' },
  parameters: {
    docs: {
      description: {
        component:
          'With `view-mode="hypergraph"`, the element draws the diagram\'s hypergraph dual: every ZX edge becomes a dot, and every non-boundary ZX node becomes a blob enclosing the dots of its incident wires. Dots sit at the midpoint of the edge they came from, so the two views line up — switch the control to `both` to see them stacked and compare. A blob is filled with the same palette entry its spider would be, so `color-scheme` applies to both views.',
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
  args: { diagram: fourSpiderSquare },
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
    // Nothing trespasses in a diagram this small, so there is no tally to draw.
    expect(root.querySelector('svg text.tally')).toBeNull()
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
          'The characteristic 2 to 2 strong complementarity diagram, testing the hypergraph rendering of more difficult hulls. A blob is the hull of its own dots, so it can swallow a dot belonging to another hyperedge: the two crossing wires land in the middle of the picture, inside all four blobs though only two hold each. The part of a dot inside a blob that does not hold it is painted red, so the drawing shows where it is claiming something untrue rather than hiding it.',
      },
    },
  },
  args: { diagram: strongComplementarityOf(2, 2) },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    const flagged = () =>
      [...root.querySelectorAll('svg g.overlap circle')].map(c => c.getAttribute('data-wire'))

    // w5 (2—5) and w6 (3—4) are the crossing wires. Each is held by two blobs
    // and sits inside the other two; every other dot is where it belongs.
    await waitFor(() => expect(flagged()).toEqual(['w5', 'w6']))

    // The red is clipped to the blobs strayed into — both of the two that don't
    // hold w6 — so only the part of the dot actually inside them is painted,
    // and a dot half in and half out comes out half red.
    const clip = root.querySelector(`clipPath[id$="-w6"]`)
    expect(clip?.querySelectorAll('path').length).toBe(2)

    // Each red mark is local, so the count is written out once in the same red,
    // below the drawing.
    const tally = root.querySelector<SVGTextElement>('svg text.tally')
    expect(tally?.textContent).toBe('2 trespassing nodes')
    expect(tally?.getAttribute('fill')).toBe('#e00')
  },
}

/** The n-to-m story builds its diagram from the two ranks' sizes rather than
 *  taking a fixed one, so the view can be pushed at any n and m from the
 *  controls panel. `diagram` is therefore not an arg of this story. */
type SizedArgs = Omit<Args, 'diagram'> & { zCount: number; xCount: number }

export const LargeStrongComplementarity: StoryObj<SizedArgs> = {
  name: '6. Strong complementarity, n to m',
  parameters: {
    docs: {
      story: {
        description:
          'The same shape at n-by-m: every one of the n×m crossing wires lands in the one column between the two ranks, and every blob has to reach across it. The worst case the view has to survive — set the two ranks from the controls to push it further.',
      },
    },
  },
  argTypes: {
    zCount: { control: { type: 'number', min: 1, max: 12, step: 1 } },
    xCount: { control: { type: 'number', min: 1, max: 12, step: 1 } },
  },
  args: { zCount: 4, xCount: 5 },
  render: ({ zCount, xCount, ...rest }) =>
    renderDiagram({ ...rest, diagram: strongComplementarityOf(zCount, xCount) }),
}

export const BothViews: Story = {
  name: '7. Both views stacked',
  parameters: {
    docs: {
      story: {
        description:
          '`view-mode="both"` runs both painters, the diagram above its dual, each scrolling in its own container. Both are drawn from the one `layout()`, so a dot sits on the midpoint of the wire drawn directly above it. The two are independent otherwise — selecting or dragging in one does nothing to the other — and the attribution badge is drawn once, into the lower of the pair.',
      },
    },
  },
  args: { diagram: fourSpiderSquare, viewMode: 'both' },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    // A painter each, in stack order, and one badge across the pair.
    await waitFor(() => expect(root.querySelectorAll('zx-viewer svg').length).toBe(1))
    expect(root.querySelectorAll('zx-hypergraph-viewer svg').length).toBe(1)
    expect(root.querySelectorAll('g.attribution').length).toBe(1)
    expect(root.querySelector('zx-hypergraph-viewer g.attribution')).not.toBeNull()
  },
}

// Labels off hides the names, not the phases: a blob's `Z(π/2)` drops to
// `π/2`, and a node with no phase to show — a default-π Hadamard — loses its
// text altogether. This mirrors `<zx-viewer>`, where `show-labels` only ever
// governed the grey id text and the phase was always painted.
export const LabelsHidden: Story = {
  name: '8. Labels hidden',
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
  name: '9. Node type with no blob',
  parameters: {
    docs: {
      story: {
        description:
          'Only spiders and Hadamards have a blob shape. A W, Z-box or `wire` node would be a hyperedge in the dual, but there is no agreed way to draw one, so `toHypergraph` rejects the diagram rather than picking a colour. `<zx-diagram>` shows the message in its error state; switch `view-mode` back to `graph` and the same diagram draws fine.',
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
