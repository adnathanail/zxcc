import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { ifDefined } from 'lit/directives/if-defined.js'
import { expect, waitFor } from 'storybook/test'
import { ZOOM } from '../../src/hypergraph/layout'
import type { DiagramData, EdgeColors } from '../../src/index'
import { fourSpiderSquare } from '../diagrams'
import { blobCaptionsIn, shadowRootOf, translateOf } from '../interactionHelpers'

interface Args {
  diagram: DiagramData
  /** Omitted by the stories that want the derived scale. */
  scale?: number
  /** Omitted by the stories that want the default: labels off. */
  showLabels?: boolean
  /** Omitted by the stories that want the palette's wire colours. */
  edgeColors?: EdgeColors
  /** Only the two arrangement stories differ here. */
  viewMode?: 'both-vertical' | 'both-horizontal'
}

const meta: Meta<Args> = {
  title: 'Other/Both viewers',
  render: ({ diagram, scale, showLabels, edgeColors, viewMode }) =>
    html`<zx-diagram
      .diagram=${diagram}
      .edgeColors=${edgeColors ?? null}
      view-mode=${viewMode ?? 'both-vertical'}
      scale=${ifDefined(scale)}
      ?show-labels=${showLabels === true}
      style="min-height: 160px"
    ></zx-diagram>`,
  parameters: {
    docs: {
      description: {
        component:
          "The diagram and its dual drawn together: the two arrangements, and the properties that do different work in each view — `show-labels`, `scale`.",
      },
    },
  },
}

export default meta

type Story = StoryObj<Args>

/** The pair's two scroll containers on screen, in DOM order — the diagram's
 *  then the dual's. The arrangement is a fact about the boxes rather than the
 *  drawings, so this is the only place it can be read. */
const containerBoxes = (root: ParentNode) =>
  [...root.querySelectorAll('.container')].map(el => el.getBoundingClientRect())

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

export const BothViewsStacked: Story = {
  name: '1. Both views stacked',
  parameters: {
    docs: {
      story: {
        description:
          '`view-mode="both-vertical"` runs both painters, the diagram above its dual, each scrolling in its own container. The dual is drawn 1.6× roomier than the diagram it comes from, so in this mode the graph is laid out again at that same scale: the two come out the same width, and a dot sits on the midpoint of the wire drawn directly above it. Dragging stays local to a view — but the selection is shared; see `Hypergraphs/Interactions`. Each view carries its own attribution badge, since the badge belongs to the picture and travels with whichever SVG is copied.',
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
  name: '2. Both views side by side',
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

// `show-labels` defaults to off, matching pyzx, so everything below has to be
// asked for: a bare `show-labels` attribute turns it on. What it adds differs
// per view, which is the reason to assert both at once — over there it is the
// grey node ids, over here the blob *names* and the wire ids. The phases are
// painted blue in both views either way, and are what stays when labels go.
export const LabelsShown: Story = {
  name: '3. Labels shown',
  parameters: {
    docs: {
      story: {
        description:
          "`show-labels` adds the grey node id above each spider in the diagram, and in the dual the blob's name and the wire id under each dot. It never governs a phase: a phase is part of what the diagram means, so it is painted — in the same blue — whether labels are on or off. A default-π Hadamard has no phase to show, so its blob is the one caption that appears only with labels on.",
      },
    },
  },
  args: {
    showLabels: true,
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
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    // The diagram view: one grey id above every node, boundaries included.
    await waitFor(() => {
      const labels = [...root.querySelectorAll('zx-viewer svg g.node text[fill="#999"]')]
      expect(labels.map(t => t.textContent)).toEqual(['0', '1', '2', '3', '4'])
    })
    // The dual: the Z and X spiders wear their names and the parens around the
    // phase, and the default-π Hadamard — nothing to say with labels off —
    // shows up as the bare name.
    expect(blobCaptionsIn(root)).toEqual([['Z(', 'π/2', ')'], ['H'], ['X(', '0', ')']])
    // The phases are blue in both views, and they are the same two phases.
    const blueIn = (tag: string) =>
      [...root.querySelectorAll(`${tag} tspan[fill="#00d"], ${tag} text[fill="#00d"]`)].map(
        t => t.textContent,
      )
    expect(blueIn('zx-hypergraph-viewer')).toEqual(['π/2', '0'])
    expect(blueIn('zx-viewer')).toEqual(['π/2', '0'])
    // The wire ids are the other thing labels bring to the dual: one per dot.
    const wireIds = [...root.querySelectorAll('zx-hypergraph-viewer svg g.dot text')]
    expect(wireIds.map(t => t.textContent)).toEqual(['w0', 'w1', 'w2', 'w3'])
  },
}

// An explicit scale is pixels per row/qubit, taken verbatim. This diagram is
// four columns wide, so the derived scale would be 800 / 5 = 160 and then get
// clamped to the 50 ceiling — 80 is reachable only by overriding.
export const ScaleOverride: Story = {
  name: '4. Scale override',
  parameters: {
    docs: {
      story: {
        description:
          "`scale` is pixels per row/qubit, taken verbatim — the 20–50 clamp that keeps a *derived* scale sane would otherwise silently override the number you asked for. In a `both` mode it is the dual that sets the pair's size, so the graph is laid out at `scale × 1.6`: the override survives the second layout, and the two pictures still come out matched.",
      },
    },
  },
  args: {
    scale: 80,
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
        { src: 2, tgt: 3 },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    const spacing = 80 * ZOOM
    const xs = await waitFor(() => {
      const found = [...root.querySelectorAll<SVGGElement>('zx-viewer svg g.node g')]
        .map(g => translateOf(g)[0])
        .sort((a, b) => a - b)
      expect(found.length).toBe(4)
      return found
    })

    // Adjacent columns sit exactly one scale apart — above the 50 the clamp
    // would otherwise impose — zoomed by the factor the pair is matched at.
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeCloseTo(spacing, 5)

    // ...and the canvas is padded by one scale either side of the outer nodes.
    const svg = root.querySelector<SVGSVGElement>('zx-viewer svg')
    if (!svg) throw new Error('graph svg not found')
    expect(Number(svg.getAttribute('width'))).toBeCloseTo(xs[xs.length - 1] + spacing, 5)

    // The dual is drawn off the *unzoomed* scale and then zoomed, which is the
    // same thing: its dots land on the midpoints of the wires beside them.
    const dots = [...root.querySelectorAll<SVGGElement>('zx-hypergraph-viewer g.dot g[data-wire]')]
      .map(g => translateOf(g)[0])
      .sort((a, b) => a - b)
    expect(dots.length).toBe(3)
    for (let i = 0; i < dots.length; i++) {
      expect(dots[i]).toBeCloseTo((xs[i] + xs[i + 1]) / 2, 5)
    }
  },
}
