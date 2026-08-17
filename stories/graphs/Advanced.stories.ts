import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect } from 'storybook/test'
import {
  type ColorSchemeName,
  type DiagramData,
  type EdgeColors,
  GRAYSCALE_COLORS,
  ORIGINAL_COLORS,
  RGB_COLORS,
} from '../../src/index'
import { paletteShowcase, pauliWebChain, selfLoopSpiders } from '../diagrams'
import {
  nodeFillsIn,
  pathDataIn,
  shadowRootOf,
  strokesIn,
  translateOf,
} from '../interactionHelpers'

interface Args {
  diagram: DiagramData
  /** Omitted by most stories, which want the default palette. */
  colorScheme?: ColorSchemeName
  /** Omitted by most stories, which want the palette's wire colours. */
  edgeColors?: EdgeColors
}

const meta: Meta<Args> = {
  title: 'Graphs/Advanced',
  render: ({ diagram, colorScheme, edgeColors }) =>
    html`<zx-diagram
      .diagram=${diagram}
      .edgeColors=${edgeColors ?? null}
      color-scheme=${colorScheme ?? 'original'}
      style="min-height: 160px"
    ></zx-diagram>`,
  parameters: {
    docs: {
      description: {
        component:
          'Shapes and annotations beyond plain Z/X spiders: W-input/W-output pairs, the Z-box, Hadamard and W-io edges, grounded vertices, vdata annotations, the global scalar, self-loops, Pauli-web strands overlaid on edges, and the non-default pyzx colour schemes.',
      },
    },
  },
}

export default meta

type Story = StoryObj<Args>

// W-input (small black circle) → W-output (black triangle). In pyzx these
// always come in pairs joined by a W_IO edge, which paints gray rather than
// black to distinguish the internal connector from an ordinary wire.
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
        { src: 1, tgt: 2, kind: 'w-io' },
        { src: 2, tgt: 3 },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    // The connector is gray (Xedge); the ordinary wires either side are black.
    expect(strokesIn(root, 'link')).toEqual([
      ORIGINAL_COLORS.edge,
      ORIGINAL_COLORS.Xedge,
      ORIGINAL_COLORS.edge,
    ])
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
        { src: 1, tgt: 2, kind: 'hadamard' },
        { src: 2, tgt: 3 },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    expect(strokesIn(root, 'link')).toEqual([
      ORIGINAL_COLORS.edge,
      ORIGINAL_COLORS.Hedge,
      ORIGINAL_COLORS.edge,
    ])
  },
}

// A wire's `kind` is only ever a colour — nothing in the layout or the geometry
// reads it — so a diagram may use kinds of its own, and `edgeColors` is where
// they get their colour. The built-in three are in that same map, so overriding
// pyzx's own H-edge blue and inventing a `control` wire are the same gesture.
export const WireColorOverrides: Story = {
  name: 'Custom wire kinds',
  parameters: {
    docs: {
      story: {
        description:
          "`edgeColors` maps wire kinds to colours, keyed by the kinds the diagram is written in rather than by pyzx's `edge`/`Hedge`/`Xedge` palette entries. Any string is a kind: `hadamard` here is a built-in being overridden, `control` and `classical` are this diagram's own. A kind with no colour given falls back to the plain wire colour, so `unnamed` and `toString` both draw black.",
      },
    },
  },
  args: {
    edgeColors: { hadamard: '#ff00aa', control: '#00aa55', classical: '#ffaa00' },
    diagram: {
      nodes: [
        { id: 0, type: 'input', ioId: 0 },
        { id: 1, type: 'spider', color: 'Z', phase: '0' },
        { id: 2, type: 'spider', color: 'X', phase: '0' },
        { id: 3, type: 'spider', color: 'Z', phase: '0' },
        { id: 4, type: 'spider', color: 'X', phase: '0' },
        { id: 5, type: 'spider', color: 'Z', phase: '0' },
        { id: 6, type: 'output', ioId: 0 },
      ],
      edges: [
        { src: 0, tgt: 1 },
        { src: 1, tgt: 2, kind: 'hadamard' },
        { src: 2, tgt: 3, kind: 'control' },
        { src: 3, tgt: 4, kind: 'classical' },
        { src: 4, tgt: 5, kind: 'unnamed' },
        { src: 5, tgt: 6, kind: 'toString' },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    expect(strokesIn(root, 'link')).toEqual([
      // No kind: the palette's plain wire.
      ORIGINAL_COLORS.edge,
      // A built-in kind, overridden — pyzx's Hedge blue doesn't get a look in.
      '#ff00aa',
      // Two kinds of the diagram's own.
      '#00aa55',
      '#ffaa00',
      // A kind nobody gave a colour: drawn like a plain wire rather than
      // failing or coming out undefined.
      ORIGINAL_COLORS.edge,
      // Same again, for a kind that names something every plain object
      // inherits. Looked up by anything other than own key, this one comes
      // back as `Object.prototype.toString` and gets painted with.
      ORIGINAL_COLORS.edge,
    ])
  },
}

// Grounded spider (pyzx's Graph.is_ground): a stem drops from the node to a
// ground symbol. Used to mark discarded/traced-out wires.
export const GroundedSpider: Story = {
  name: 'Grounded spider',
  args: {
    diagram: {
      nodes: [
        { id: 0, type: 'input', ioId: 0 },
        { id: 1, type: 'spider', color: 'Z', phase: '0', ground: true },
        { id: 2, type: 'output', ioId: 0 },
      ],
      edges: [
        { src: 0, tgt: 1 },
        { src: 1, tgt: 2 },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    // The stem and the ground symbol are two extra selectable paths on the
    // node group, on top of the spider's own circle.
    const stems = root.querySelectorAll('svg g.node path.selectable')
    expect(stems.length).toBe(2)
  },
}

// vdata: arbitrary [key, value] annotations drawn above a node, mirroring
// pyzx's draw_d3(vdata=[...]).
export const VertexData: Story = {
  name: 'Vertex data annotations',
  args: {
    diagram: {
      nodes: [
        { id: 0, type: 'input', ioId: 0 },
        {
          id: 1,
          type: 'spider',
          color: 'Z',
          phase: 'π/2',
          vdata: [
            ['depth', 3],
            ['tag', 'pivot'],
          ],
        },
        { id: 2, type: 'output', ioId: 0 },
      ],
      edges: [
        { src: 0, tgt: 1 },
        { src: 1, tgt: 2 },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    const spans = [...root.querySelectorAll('svg g.node tspan')].map(t => t.textContent)
    expect(spans).toEqual(['depth: 3', 'tag: pivot'])
  },
}

// The diagram's global scalar, painted below the diagram. Shown whenever
// `scalar` is present — unlike pyzx, which needs a separate show_scalar flag
// because its graphs always carry a Scalar object.
export const Scalar: Story = {
  name: 'Global scalar',
  args: {
    diagram: {
      nodes: [
        { id: 0, type: 'input', ioId: 0 },
        { id: 1, type: 'spider', color: 'Z', phase: 'π/2' },
        { id: 2, type: 'output', ioId: 0 },
      ],
      edges: [
        { src: 0, tgt: 1 },
        { src: 1, tgt: 2 },
      ],
      scalar: '2^(-1/2)·e^(iπ/4)',
    },
  },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    const svg = root.querySelector<SVGSVGElement>('svg')
    if (!svg) throw new Error('svg not found')

    const scalar = [...svg.querySelectorAll<SVGTextElement>(':scope > text')].find(t =>
      t.textContent?.includes('2^(-1/2)·e^(iπ/4)'),
    )
    if (!scalar) throw new Error('scalar text not rendered')

    // Centred on the canvas rather than pinned to pyzx's fixed x: 60.
    expect(scalar.getAttribute('text-anchor')).toBe('middle')
    expect(Number(scalar.getAttribute('x'))).toBeCloseTo(Number(svg.getAttribute('width')) / 2, 1)
    expect(scalar.getAttribute('font-family')).toBe('monospace')

    // In the strip below the diagram, clear of every node...
    const nodeYs = [...svg.querySelectorAll<SVGGElement>('g.node g')].map(g => translateOf(g)[1])
    const scalarY = Number(scalar.getAttribute('y'))
    expect(scalarY).toBeGreaterThan(Math.max(...nodeYs))

    // ...and above the attribution badge, which is anchored to the bottom-right
    // of the same SVG. Compared against its real position rather than a fixed
    // margin, so retuning the strip can't silently start overlapping it. The
    // chip's y is in the group's own space, so it needs the group's translate
    // added back to land in the coordinates the scalar is placed in.
    const attribution = svg.querySelector<SVGGElement>('g.attribution')
    const chip = attribution?.querySelector('rect')
    if (!attribution || !chip) throw new Error('attribution badge not rendered')
    expect(scalarY).toBeLessThan(Number(chip.getAttribute('y')) + translateOf(attribution)[1])

    // Leading '×' in the node-id grey, then the value itself.
    const [times, value] = [...scalar.querySelectorAll('tspan')]
    expect(times.textContent).toBe('×')
    expect(times.getAttribute('fill')).toBe('#999')
    expect(value.textContent).toBe('2^(-1/2)·e^(iπ/4)')
  },
}

// A self-loop can't be drawn as a straight line, so it arcs out of the node
// and back. The left spider carries one loop, the right two — a lone loop
// uses the fixed ±40 control points, while a second loop on the same node is
// widened by parallel-edge indexing so the arcs stay visually distinct.
export const SelfLoops: Story = {
  name: 'Self-loops',
  args: { diagram: selfLoopSpiders },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    const ds = pathDataIn(root, 'link')
    expect(ds.length).toBe(6)
    // Three links are cubic arcs — one loop left, two right; the other three
    // are straight wires.
    const curves = ds.filter(d => d.includes('C'))
    expect(curves.length).toBe(3)
    // Spread by index, so no two loops are drawn on top of each other.
    expect(new Set(curves).size).toBe(3)
  },
}

// Pauli web: coloured strands overlaid on edges to visualise error
// propagation. X = pink, Y = light blue, Z = dark green, I = grey.
export const PauliWeb: Story = {
  name: 'Pauli-web overlay',
  args: { diagram: pauliWebChain },
}

// Every palette key at once, in the default scheme — the reference the two
// stories below are meant to be compared against.
export const OriginalScheme: Story = {
  name: 'Colour scheme: original',
  args: { diagram: paletteShowcase, colorScheme: 'original' },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    const fills = nodeFillsIn(root)
    // Pale green Z spiders and a blue Hadamard edge — the two things the
    // other schemes move away from.
    expect(fills).toContain(ORIGINAL_COLORS.Z)
    const strokes = strokesIn(root, 'link')
    expect(strokes.length).toBe(8)
    expect(strokes).toContain(ORIGINAL_COLORS.Hedge)
  },
}

// pyzx's rgb_colors: Y and Z swap (so Z spiders go light blue while the
// Z-box keeps Zalt's green), Ydark/Zdark swap under the Pauli web, and the
// Hadamard edge turns orange. Everything else matches `original`.
export const RgbScheme: Story = {
  name: 'Colour scheme: rgb',
  args: { diagram: paletteShowcase, colorScheme: 'rgb' },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    const fills = nodeFillsIn(root)
    // Round Z spiders repaint; X and H don't...
    expect(nodeFillsIn(root, 'circle')).toContain(RGB_COLORS.Z)
    expect(nodeFillsIn(root, 'circle')).not.toContain(ORIGINAL_COLORS.Z)
    expect(fills).toContain(RGB_COLORS.X)
    expect(fills).toContain(RGB_COLORS.H)
    // ...and neither does the Z-box, which reads Zalt rather than Z.
    expect(nodeFillsIn(root, 'rect')).toContain(RGB_COLORS.Zalt)

    // Orange Hadamard edge instead of blue.
    const strokes = strokesIn(root, 'link')
    expect(strokes).toContain(RGB_COLORS.Hedge)
    expect(strokes).not.toContain(ORIGINAL_COLORS.Hedge)

    // Web strands, in `pauliWeb` order: X, Z, Y — with Zdark/Ydark swapped.
    expect(strokesIn(root, 'web')).toEqual([RGB_COLORS.Xdark, RGB_COLORS.Zdark, RGB_COLORS.Ydark])
  },
}

// pyzx's grayscale_colors: every spider, box and edge colour drops to a grey,
// leaving shape (circle / square / triangle) as the only cue that survives
// printing in black and white.
export const GrayscaleScheme: Story = {
  name: 'Colour scheme: grayscale',
  args: { diagram: paletteShowcase, colorScheme: 'grayscale' },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    const fills = nodeFillsIn(root)
    expect(fills).toContain(GRAYSCALE_COLORS.Z)
    expect(fills).toContain(GRAYSCALE_COLORS.X)
    expect(fills).toContain(GRAYSCALE_COLORS.H)
    // None of the original scheme's tints survive.
    for (const key of ['Z', 'X', 'H'] as const) {
      expect(fills).not.toContain(ORIGINAL_COLORS[key])
    }

    // Grey Hadamard edge, and a lighter grey W_IO connector.
    const strokes = strokesIn(root, 'link')
    expect(strokes).toContain(GRAYSCALE_COLORS.Hedge)
    expect(strokes).toContain(GRAYSCALE_COLORS.Xedge)
    expect(strokes).not.toContain(ORIGINAL_COLORS.Hedge)
  },
}
