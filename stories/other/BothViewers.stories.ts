import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { ifDefined } from 'lit/directives/if-defined.js'
import { expect, waitFor } from 'storybook/test'
import { ZOOM } from '../../src/hypergraph/layout'
import { type DiagramData, type EdgeColors, RGB_COLORS } from '../../src/index'
import { fourSpiderSquare } from '../diagrams'
import {
  blobCaptionsIn,
  blobIdsIn,
  dotIdsIn,
  firePointer,
  ringedDotsIn,
  selectedBlobsIn,
  selectedNodesIn,
  shadowRootOf,
  translateOf,
  type ViewRoot,
} from '../interactionHelpers'

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
  /** Omitted by the stories that want pyzx's original palette. */
  colorScheme?: 'original' | 'rgb' | 'grayscale'
  /** Omitted by every story but the one it belongs to. */
  disableIOBlobs?: boolean
}

const meta: Meta<Args> = {
  title: 'Other/Both viewers',
  render: ({ diagram, scale, showLabels, edgeColors, viewMode, colorScheme, disableIOBlobs }) =>
    html`<zx-diagram
      .diagram=${diagram}
      .edgeColors=${edgeColors ?? null}
      view-mode=${viewMode ?? 'both-vertical'}
      color-scheme=${colorScheme ?? 'original'}
      scale=${ifDefined(scale)}
      ?disable-io-blobs-in-hypergraph=${disableIOBlobs === true}
      ?show-labels=${showLabels === true}
      style="min-height: 160px"
    ></zx-diagram>`,
  parameters: {
    docs: {
      description: {
        component:
          'The diagram and its dual drawn together: the two arrangements, and the `<zx-diagram>` properties whose work only shows up when both views are on screen — `show-labels` and `scale`, which do different things in each view; `color-scheme`, which has to reach both; and `disable-io-blobs-in-hypergraph`, which has no counterpart on `<zx-hypergraph>` at all.',
      },
    },
  },
}

export default meta

type Story = StoryObj<Args>

/** The pair's two scroll containers on screen, in DOM order — the diagram's
 *  then the dual's. The arrangement is a fact about the boxes rather than the
 *  drawings, so this is the only place it can be read. */
const containerBoxes = (root: ViewRoot) =>
  [...root.querySelectorAll('.container')].map(el => el.getBoundingClientRect())

/** Everything the two `both` modes share: which painters ran, that the pair is
 *  drawn at one scale, and that each badge was measured against its own view.
 *  Only the arrangement differs between them, so only that is asserted per
 *  story. */
const expectPairDrawn = async (root: ViewRoot) => {
  // A painter each, and a badge in each of the two.
  await waitFor(() => expect(root.querySelectorAll('zx-viewer svg').length).toBe(1))
  expect(root.querySelectorAll('zx-hypergraph-viewer svg').length).toBe(1)
  expect(root.querySelectorAll('g.attribution').length).toBe(2)

  // The graph is laid out at the dual's zoomed scale, so the pair is one size —
  // a diagram with no blob overhanging its box comes out exact on both axes.
  // The height is the fussier of the two: a scalar reserves a strip of fixed
  // pixels under the drawing, and only the drawing is proportional to the
  // scale, so a canvas that zoomed the strip along with it would come out
  // taller than its partner.
  const sizeOf = (tag: string) => {
    const svg = root.querySelector<SVGSVGElement>(`${tag} svg`)
    return [Number(svg?.getAttribute('width')), Number(svg?.getAttribute('height'))]
  }
  const [graphWidth, graphHeight] = sizeOf('zx-viewer')
  const [dualWidth, dualHeight] = sizeOf('zx-hypergraph-viewer')
  expect(graphWidth).toBeCloseTo(dualWidth, 6)
  expect(graphHeight).toBeCloseTo(dualHeight, 6)

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
  // Carries a scalar, which is the case that makes the two heights hard to
  // match: it reserves a strip of fixed pixels under the diagram, and the dual
  // reserves the same strip without drawing anything in it.
  args: {
    diagram: { ...fourSpiderSquare, scalar: '1/√2' },
    viewMode: 'both-horizontal',
  },
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
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    // The diagram view: one grey id above every node, boundaries included.
    await waitFor(() => {
      const labels = [...root.querySelectorAll('zx-viewer svg g.node text[fill="#999"]')]
      expect(labels.map(t => t.textContent)).toEqual(['0', '1', '2', '3', '4'])
    })
    // The dual: the Z and X spiders wear their names and the parens around the
    // phase, the default-π Hadamard — nothing to say with labels off — shows up
    // as the bare name, and each boundary says which end of the diagram it is.
    expect(blobCaptionsIn(root)).toEqual([
      ['in'],
      ['Z(', 'π/2', ')'],
      ['H'],
      ['X(', 'π', ')'],
      ['out'],
    ])
    // The phases are blue in both views, and they are the same two phases.
    const blueIn = (tag: string) =>
      [...root.querySelectorAll(`${tag} tspan[fill="#00d"], ${tag} text[fill="#00d"]`)].map(
        t => t.textContent,
      )
    expect(blueIn('zx-hypergraph-viewer')).toEqual(['π/2', 'π'])
    expect(blueIn('zx-viewer')).toEqual(['π/2', 'π'])
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

export const SharedPalette: Story = {
  name: '5. Shared palette',
  parameters: {
    docs: {
      story: {
        description:
          '`<zx-diagram>` mounts a `<zx-graph>` and a `<zx-hypergraph>` — the same two elements you could have written yourself — and passes the presentation properties down, the palette already resolved, so a scheme set once here reaches both pictures. `color-scheme="rgb"` paints the Z spiders green in the diagram and their blobs the same green in the dual: a spider and the blob standing for it cannot come out different colours, because both painters read one lookup.',
      },
    },
  },
  args: { diagram: fourSpiderSquare, colorScheme: 'rgb' },
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('zx-diagram')
    if (!el?.shadowRoot) throw new Error('zx-diagram not found')
    await el.updateComplete

    // The pair is two public elements, one per view, rather than two painters
    // mounted directly — which is what makes each of them usable on its own.
    expect(el.shadowRoot.querySelectorAll('zx-graph').length).toBe(1)
    expect(el.shadowRoot.querySelectorAll('zx-hypergraph').length).toBe(1)

    const root = await shadowRootOf(canvasElement)
    const green = (selector: string) =>
      [...root.querySelectorAll<SVGElement>(selector)]
        .map(el => el.getAttribute('fill'))
        .filter(fill => fill === RGB_COLORS.Z).length

    const spiders = await waitFor(() => {
      const count = green('zx-viewer g.node circle')
      expect(count).toBeGreaterThan(0)
      return count
    })
    expect(green('zx-hypergraph-viewer g.blob path')).toBe(spiders)
  },
}

export const WithoutBoundaryBlobs: Story = {
  name: '6. Without input/output blobs',
  argTypes: { disableIOBlobs: { control: 'boolean' } },
  parameters: {
    docs: {
      story: {
        description:
          "The four-spider square with `disable-io-blobs-in-hypergraph`. Every input and output loses its circle in the dual; the dots stay, since a boundary leg is still a wire. What goes with the circles is the rule that reads a boundary leg apart from a self-loop — both are then a single dot held by one blob — which is why the blobs are drawn unless asked otherwise. The property is `<zx-diagram>`'s alone: a hypergraph written out by hand says the same thing by leaving those hyperedges out, which is why the pair is the place to see what it costs. Turn the control off to compare.",
      },
    },
  },
  args: { diagram: fourSpiderSquare, disableIOBlobs: true },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    // The square's boundaries are nodes 0, 1, 6 and 7; the spiders are 2 to 5,
    // so those four blobs are what is left.
    await waitFor(() => expect([...blobIdsIn(root)].sort()).toEqual(['e2', 'e3', 'e4', 'e5']))
    // Every wire still has its dot, boundary legs included.
    expect(dotIdsIn(root).length).toBe(fourSpiderSquare.edges.length)
    // The boundaries are still drawn over in the diagram — only the dual's
    // circles went, which is the whole of what the property does.
    expect(root.querySelectorAll('zx-viewer g.node g[data-node]').length).toBe(
      fourSpiderSquare.nodes.length,
    )

    // Input 0 is still a node to press in the diagram, and its leg is still a
    // dot over here, so the selection still crosses: every wire says which
    // nodes are at its ends whether or not both are drawn. What is missing is
    // the blob — nothing is named in the dual, and the leg's dot is dashed, the
    // way it would be under a boundary blob that was there.
    const input0 = root.querySelector<SVGGElement>('zx-viewer g[data-node="0"]')
    if (!input0) throw new Error('input 0 not mounted')
    const [x, y] = translateOf(input0)
    firePointer('pointerdown', input0, x, y)
    firePointer('pointerup', window, x, y)
    await waitFor(() => expect(selectedNodesIn(root)).toEqual([0]))
    expect(selectedBlobsIn(root)).toEqual([])
    expect(ringedDotsIn(root, 'implied')).toEqual(['w0'])
  },
}
