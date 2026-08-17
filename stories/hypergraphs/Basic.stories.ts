import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect, waitFor } from 'storybook/test'
import type { EdgeColors, ViewMode } from '../../src/index'
import type { DiagramData } from '../../src/types'
import { fourSpiderSquare, strongComplementarityOf } from '../diagrams'
import { shadowRootOf, translateOf } from '../interactionHelpers'

interface Args {
  diagram: DiagramData
  viewMode: ViewMode
  showLabels: boolean
  colorScheme: 'original' | 'rgb' | 'grayscale'
  /** Omitted by most stories, which want the palette's wire colours. */
  edgeColors?: EdgeColors
}

const renderDiagram = ({ diagram, viewMode, showLabels, colorScheme, edgeColors }: Args) =>
  html`<zx-diagram
    .diagram=${diagram}
    .edgeColors=${edgeColors ?? null}
    view-mode=${viewMode}
    show-labels=${showLabels ? 'true' : 'false'}
    color-scheme=${colorScheme}
    style="min-height: 160px"
  ></zx-diagram>`

const meta: Meta<Args> = {
  title: 'Hypergraphs/Basic',
  render: renderDiagram,
  argTypes: {
    viewMode: {
      control: 'inline-radio',
      options: ['graph', 'hypergraph', 'both-vertical', 'both-horizontal'],
    },
    showLabels: { control: 'boolean' },
    colorScheme: { control: 'select', options: ['original', 'rgb', 'grayscale'] },
  },
  args: { viewMode: 'hypergraph', showLabels: true, colorScheme: 'original' },
  parameters: {
    docs: {
      description: {
        component:
          'With `view-mode="hypergraph"`, the element draws the diagram\'s hypergraph dual: every ZX edge becomes a dot, and every non-boundary ZX node becomes a blob enclosing the dots of its incident wires. Dots sit at the midpoint of the edge they came from, so the two views line up — switch the control to `both-vertical` or `both-horizontal` to see them together and compare. A blob is filled with the same palette entry its spider would be, so `color-scheme` applies to both views.',
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

/** Everything the two `both` modes share: which painters ran, that the pair is
 *  drawn at one scale, and that each badge was measured against its own view.
 *  Only the arrangement differs between them, so only that is asserted per
 *  story. */
const expectPairDrawn = async (root: ParentNode) => {
  // A painter each, and a badge in each of the two.
  await waitFor(() => expect(root.querySelectorAll('zx-viewer svg').length).toBe(1))
  expect(root.querySelectorAll('zx-hypergraph-viewer svg').length).toBe(1)
  expect(root.querySelectorAll('g.attribution').length).toBe(2)

  // The graph is laid out at the dual's zoomed scale, so the pair is one
  // width — a diagram with no blob overhanging its box comes out exact.
  const widthOf = (tag: string) =>
    Number(root.querySelector<SVGSVGElement>(`${tag} svg`)?.getAttribute('width'))
  expect(widthOf('zx-viewer')).toBeCloseTo(widthOf('zx-hypergraph-viewer'), 6)

  // One scale means the two line up: wire w0 is the first edge, 0—2, and its
  // dot sits at the midpoint of those two nodes as the graph draws them — the
  // same numbers, not merely the same proportions, whichever way the pair is
  // arranged.
  const at = (selector: string) => {
    const g = root.querySelector<SVGGElement>(selector)
    if (!g) throw new Error(`${selector} not mounted`)
    return translateOf(g)
  }
  const [ax, ay] = at('zx-viewer g[data-node="0"]')
  const [bx, by] = at('zx-viewer g[data-node="2"]')
  const [dx, dy] = at('g.dot g[data-wire="w0"]')
  expect(dx).toBeCloseTo((ax + bx) / 2, 6)
  expect(dy).toBeCloseTo((ay + by) / 2, 6)
  // Each badge is measured against its own painter's box rather than sharing
  // one measurement: its chip's right edge lands on that SVG's own width.
  for (const tag of ['zx-viewer', 'zx-hypergraph-viewer']) {
    const svg = root.querySelector<SVGSVGElement>(`${tag} svg`)
    const badge = root.querySelector<SVGGElement>(`${tag} g.attribution`)
    const chip = badge?.querySelector('rect')
    if (!svg || !badge || !chip) throw new Error(`${tag} badge not rendered`)
    const right =
      translateOf(badge)[0] + Number(chip.getAttribute('x')) + Number(chip.getAttribute('width'))
    expect(right).toBeCloseTo(Number(svg.getAttribute('width')), 6)
  }
}

/** The pair's two scroll containers on screen, in DOM order — the diagram's
 *  then the dual's. The arrangement is a fact about the boxes rather than the
 *  drawings, so this is the only place it can be read. */
const containerBoxes = (root: ParentNode) =>
  [...root.querySelectorAll('.container')].map(el => el.getBoundingClientRect())

export const BothViewsStacked: Story = {
  name: '7. Both views stacked',
  parameters: {
    docs: {
      story: {
        description:
          '`view-mode="both-vertical"` runs both painters, the diagram above its dual, each scrolling in its own container. The dual is drawn 1.6× roomier than the diagram it comes from, so in this mode the graph is laid out again at that same scale: the two come out the same width, and a dot sits on the midpoint of the wire drawn directly above it. The two are independent otherwise — selecting or dragging in one does nothing to the other — and each carries its own attribution badge, since the badge belongs to the picture and travels with whichever SVG is copied.',
      },
    },
  },
  args: { diagram: fourSpiderSquare, viewMode: 'both-vertical' },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    await expectPairDrawn(root)
    // Stacked: the dual starts below the diagram, and the two share a left edge
    // — which is what puts a dot under the wire it stands for on the page and
    // not merely at matching coordinates inside two SVGs.
    const [graph, dual] = containerBoxes(root)
    expect(dual.top).toBeGreaterThanOrEqual(graph.bottom)
    expect(dual.left).toBeCloseTo(graph.left, 1)
  },
}

export const BothViewsSideBySide: Story = {
  name: '8. Both views side by side',
  parameters: {
    docs: {
      story: {
        description:
          '`view-mode="both-horizontal"` draws the same pair across instead of down, the diagram to the left of its dual. The pair is matched the same way — one scale, so a dot lands level with the wire it stands for — and the two split the width evenly, each scrolling its own picture rather than sizing to it. Stacked reads best on a diagram that is wider than it is tall, side by side on a tall one; nothing else changes between the two.',
      },
    },
  },
  args: { diagram: fourSpiderSquare, viewMode: 'both-horizontal' },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    await expectPairDrawn(root)
    // Side by side: the dual starts to the right of the diagram, the two share
    // a top edge, and neither has been squeezed out — they take a half each,
    // whatever the drawings inside them measure.
    const [graph, dual] = containerBoxes(root)
    expect(dual.left).toBeGreaterThanOrEqual(graph.right)
    expect(dual.top).toBeCloseTo(graph.top, 1)
    expect(dual.width).toBeCloseTo(graph.width, 1)
  },
}

// Labels off hides the names, not the phases: a blob's `Z(π/2)` drops to
// `π/2`, and a node with no phase to show — a default-π Hadamard — loses its
// text altogether. This mirrors `<zx-viewer>`, where `show-labels` only ever
// governed the grey id text and the phase was always painted.
export const LabelsHidden: Story = {
  name: '9. Labels hidden',
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
  name: '10. Node type with no blob',
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

// Both painters read a wire's colour from the one `edgeColor` lookup, so a
// kind invented for a diagram reaches the dual for nothing: the dot standing
// for a wire cannot come out a different colour from the wire itself.
export const WireColors: Story = {
  name: '10. Custom wire kinds',
  parameters: {
    docs: {
      story: {
        description:
          "A colour per wire kind, keyed by the kinds the diagram is written in — `control` here is this diagram's own, `hadamard` a built-in being overridden. Drawn in both views at once: each wire's colour in the diagram is the colour of its dot in the dual.",
      },
    },
  },
  args: {
    viewMode: 'both-vertical',
    edgeColors: { hadamard: '#ff00aa', control: '#00aa55' },
    diagram: {
      nodes: [
        { id: 0, type: 'input', ioId: 0 },
        { id: 1, type: 'spider', color: 'Z', phase: '0' },
        { id: 2, type: 'spider', color: 'X', phase: '0' },
        { id: 3, type: 'output', ioId: 0 },
      ],
      edges: [
        { src: 0, tgt: 1, kind: 'control' },
        { src: 1, tgt: 2, kind: 'hadamard' },
        { src: 2, tgt: 3 },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    const dotFill = (wire: string) =>
      root
        .querySelector<SVGCircleElement>(`zx-hypergraph-viewer g[data-wire="${wire}"] circle`)
        ?.getAttribute('fill')
    await waitFor(() => expect(dotFill('w0')).not.toBeUndefined())
    // Wire i and dot wi are the same edge — the custom kind, the overridden
    // built-in, and the wire left on the palette's own colour.
    const wires = [...root.querySelectorAll<SVGPathElement>('zx-viewer g.link path')]
    expect(wires.map(w => w.getAttribute('stroke'))).toEqual(['#00aa55', '#ff00aa', '#000000'])
    expect(['w0', 'w1', 'w2'].map(dotFill)).toEqual(['#00aa55', '#ff00aa', '#000000'])
  },
}
