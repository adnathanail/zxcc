import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect, waitFor } from 'storybook/test'
import type { HypergraphInput } from '../../src/index'
import { firePointer, selectedBlobsIn, shadowRootOf, translateOf } from '../interactionHelpers'

interface Args {
  hypergraph: HypergraphInput
  showLabels: boolean
  scale: number
  colorScheme: 'original' | 'rgb' | 'grayscale'
}

const meta: Meta<Args> = {
  title: 'Hypergraphs/Direct input',
  render: ({ hypergraph, showLabels, scale, colorScheme }) =>
    html`<zx-hypergraph
      .hypergraph=${hypergraph}
      ?show-labels=${showLabels}
      scale=${scale}
      color-scheme=${colorScheme}
      style="min-height: 160px"
    ></zx-hypergraph>`,
  argTypes: {
    showLabels: { control: 'boolean' },
    scale: { control: { type: 'range', min: 15, max: 70, step: 1 } },
    colorScheme: { control: 'select', options: ['original', 'rgb', 'grayscale'] },
  },
  args: { showLabels: true, scale: 35, colorScheme: 'original' },
  parameters: {
    docs: {
      description: {
        component:
          '`<zx-hypergraph>` draws a hypergraph given directly, rather than one derived from a ZX diagram. The input is the dots and which grid square each one goes in, plus which of them each blob holds — nothing is worked out, so the drawing is exactly what was asked for. Everything downstream is the same as in the derived view: the same painter, the same palette, the same presses. `scale` is the one number the input does not carry: it is pixels per column and per qubit, so it sets how far apart the dots are drawn as well as how big one is.',
      },
    },
  },
}

export default meta

type Story = StoryObj<Args>

/** A wire is a hypergraph node, drawn as a dot; a hyperedge is a blob around
 *  the dots it holds. Every wire is held by exactly two hyperedge ends, which
 *  is what makes this a ZX diagram written the other way round: `w0` runs
 *  between the input boundary and the first spider, and so on down the chain. */
const chain: HypergraphInput = {
  wires: [
    { col: 0, qubit: 0 },
    { col: 1, qubit: 0 },
    { col: 2, qubit: 0 },
  ],
  hyperedges: [
    { kind: 'boundary', name: 'in', wires: [0] },
    { kind: 'z-spider', phase: 'π/2', wires: [0, 1] },
    { kind: 'x-spider', wires: [1, 2] },
    { kind: 'boundary', name: 'out', wires: [2] },
  ],
}

export const Chain: Story = {
  name: '1. A hypergraph, written out',
  parameters: {
    docs: {
      story: {
        description:
          'The dual of `input → Z(π/2) → X → output`, written as a hypergraph instead of derived from one: three dots in a row, a blob around each pair of neighbours, and a circle round each of the two dots that hang off a boundary. Dots land on the grid squares given rather than on the midpoints of any wire — one column apart is one `scale` apart — and the canvas is measured around them.',
      },
    },
  },
  args: { hypergraph: chain },
  play: async ({ canvasElement, args }) => {
    const root = await shadowRootOf(canvasElement, 'zx-hypergraph')
    const dotAt = (wire: string) => {
      const dot = root.querySelector<SVGGElement>(`g[data-wire="${wire}"]`)
      if (!dot) throw new Error(`dot ${wire} not mounted`)
      return translateOf(dot)
    }

    // The grid is the input's, untouched, scaled to pixels: three wires one
    // column apart come out one `scale` apart on the same qubit line.
    const [x0, y0] = await waitFor(() => dotAt('w0'))
    expect(dotAt('w1')).toEqual([x0 + args.scale, y0])
    expect(dotAt('w2')).toEqual([x0 + 2 * args.scale, y0])

    // One blob per hyperedge, in the order they were listed, and each captioned
    // with the name it was given — a boundary has no letter of its own, so `in`
    // and `out` are the input's to say.
    const blobs = [...root.querySelectorAll('svg g.blob > g[data-hyperedge]')]
    expect(blobs.map(b => b.getAttribute('data-hyperedge'))).toEqual(['e0', 'e1', 'e2', 'e3'])
    expect(blobs[0].querySelector('text')?.textContent).toBe('in')

    // The phase is drawn in the same blue `<zx-viewer>` writes one in, whether
    // labels are on or off — the name is the half `show-labels` governs.
    const phase = root.querySelector('svg g.blob text tspan[fill="#00d"]')
    expect(phase?.textContent).toBe('π/2')
  },
}

/** What the derived view cannot produce: dots wherever you want them. Three
 *  spiders each joined to the other two, one carrying a self-loop, and a
 *  boundary hanging off the X spider.
 *
 *  A self-loop is the same wire at both ends of one hyperedge — `w3` listed
 *  twice in `e0` — so it is drawn as a single dot that only one blob holds.
 *  Every other dot is in two, one per end. */
const triangle: HypergraphInput = {
  wires: [
    { col: 1, qubit: 0 },
    { col: 1.5, qubit: 1.5 },
    { col: 0, qubit: 1.5 },
    { col: 0.25, qubit: -0.5, kind: 'hadamard' },
    { col: 3, qubit: 0.5 },
  ],
  hyperedges: [
    { kind: 'z-spider', wires: [0, 2, 3, 3] },
    { kind: 'x-spider', phase: 'π', wires: [0, 1, 4] },
    { kind: 'z-spider', phase: 'π/4', wires: [1, 2] },
    { kind: 'boundary', name: 'in', wires: [4] },
  ],
}

export const Triangle: Story = {
  name: '2. A shape no layout would give you',
  parameters: {
    docs: {
      story: {
        description:
          "Three spiders each joined to the other two, drawn as a triangle of dots rather than as the columns a ZX layout would put them in — the grid takes fractional coordinates, and negative ones, so a dot goes wherever it is wanted. `w3` is a self-loop — the same wire at both ends of one hyperedge — and its dot is the only one a single blob holds; the H-wire colour is the input's to choose, per wire. Pressing a dot still selects the wire and outlines the blobs holding it, exactly as in the derived view.",
      },
    },
  },
  args: { hypergraph: triangle },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement, 'zx-hypergraph')
    const svg = await waitFor(() => {
      const el = root.querySelector<SVGSVGElement>('svg')
      if (!el) throw new Error('hypergraph svg not mounted')
      return el
    })
    const dot = (wire: string) => {
      const g = root.querySelector<SVGGElement>(`g[data-wire="${wire}"]`)
      if (!g) throw new Error(`dot ${wire} not mounted`)
      return g
    }

    // Five wires, four hyperedges — the self-loop is one dot, not two.
    expect(root.querySelectorAll('svg g.dot > g[data-wire]').length).toBe(5)
    expect(root.querySelectorAll('svg g.blob > g[data-hyperedge]').length).toBe(4)

    // A caption sits above its blob's outline, which itself stands off the
    // highest dot the blob holds — so the canvas has to be measured with room
    // for it. `w3` is on the topmost qubit here and the blob holding it is
    // captioned, so its caption is written above everything else drawn.
    // Measured off the rendered glyphs rather than recomputed: what matters is
    // that the text is on the canvas.
    for (const caption of root.querySelectorAll<SVGTextElement>('svg g.blob text')) {
      expect(caption.getBBox().y).toBeGreaterThanOrEqual(0)
    }

    // A press on a dot names the wire and implies the blobs holding it. The
    // self-loop's two ends are the same hyperedge, so exactly one blob is
    // outlined — the count that tells a loop from a boundary leg in the dual.
    // Dispatched on the dot itself: a press is read from what it landed on, and
    // one aimed at bare canvas asks a different question — which blobs contain
    // the point — rather than which hyperedges hold this wire.
    const box = svg.getBoundingClientRect()
    const press = (wire: string) => {
      const [x, y] = translateOf(dot(wire))
      firePointer('pointerdown', dot(wire), box.left + x, box.top + y)
    }
    press('w3')
    await waitFor(() => expect(selectedBlobsIn(root, 'implied')).toEqual(['e0']))

    // Where a wire runs between two spiders, both are outlined.
    press('w0')
    await waitFor(() => expect(selectedBlobsIn(root, 'implied')).toEqual(['e0', 'e1']))
  },
}

/** The same hypergraph at two scales. Being on a grid is what makes this one
 *  number: every position is a multiple of it, so the drawing and the marks on
 *  it grow together. */
export const Scaling: Story = {
  name: '3. One grid, two scales',
  parameters: {
    docs: {
      story: {
        description:
          "The chain drawn at `scale=20` and at `scale=50`, the two ends of the band a derived diagram's scale is clamped to. Positions are grid coordinates rather than pixels, so `scale` moves the dots as well as sizing them: the picture on the right is the one on the left, larger. Nothing in the input differs between the two.",
      },
    },
  },
  args: { hypergraph: chain },
  render: ({ hypergraph, showLabels, colorScheme }) =>
    html`<div style="display: flex; gap: 16px; align-items: flex-start">
      <zx-hypergraph
        id="small"
        .hypergraph=${hypergraph}
        ?show-labels=${showLabels}
        scale="20"
        color-scheme=${colorScheme}
      ></zx-hypergraph>
      <zx-hypergraph
        id="large"
        .hypergraph=${hypergraph}
        ?show-labels=${showLabels}
        scale="50"
        color-scheme=${colorScheme}
      ></zx-hypergraph>
    </div>`,
  play: async ({ canvasElement }) => {
    // The gap between two dots one column apart is the scale itself, which is
    // what "on a grid" buys: the same input reads as the same picture at any
    // size, rather than as fixed coordinates with bigger marks on them.
    const step = async (id: string) => {
      const root = await shadowRootOf(canvasElement, `#${id}`)
      const dots = await waitFor(() => {
        const found = [...root.querySelectorAll<SVGGElement>('svg g.dot > g[data-wire]')]
        if (found.length !== 3) throw new Error(`#${id} has ${found.length} dots, expected 3`)
        return found
      })
      const [x0] = translateOf(dots[0])
      const [x1] = translateOf(dots[1])
      return x1 - x0
    }

    expect(await step('small')).toBe(20)
    expect(await step('large')).toBe(50)
  },
}
