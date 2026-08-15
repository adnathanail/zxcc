import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect, waitFor } from 'storybook/test'
import { type DiagramData, ORIGINAL_COLORS } from '../src/zxRender'
import { singleZSpider, zHzChain, zxSpiders } from './diagrams'
import {
  fireKey,
  fireMouse,
  performDrag,
  shadowRootOf,
  translateOf,
  waitForNode,
} from './interactionHelpers'

interface Args {
  diagram: DiagramData
}

const meta: Meta<Args> = {
  title: 'Interactions/Drag',
  render: ({ diagram }) =>
    html`<zx-diagram .diagram=${diagram} style="min-height: 160px"></zx-diagram>`,
  parameters: {
    docs: {
      description: {
        component:
          'Interaction tests guarding the D3 drag/selection behaviour: single-node drag, shift-click multi-select drag, H-box parametric constraint, and brush-select-then-drag. Each play function dispatches native MouseEvents/KeyboardEvents and asserts on `<g>` translate deltas.',
      },
    },
  },
}

export default meta

type Story = StoryObj<Args>

const Z_FILL = ORIGINAL_COLORS.Z
const X_FILL = ORIGINAL_COLORS.X
const H_FILL = ORIGINAL_COLORS.H

// —————————————————————————————————————————————————————————————————————————
// 1. Single-spider drag — baseline that translate deltas propagate at all.
// —————————————————————————————————————————————————————————————————————————

export const DragSingleSpider: Story = {
  name: '1. Drag a single Z spider',
  args: { diagram: singleZSpider },
  play: async ({ canvasElement, step }) => {
    const DX = 40
    const DY = 30

    const root = await shadowRootOf(canvasElement)
    let spider!: SVGGElement
    await step('wait for Z spider to mount', async () => {
      spider = await waitForNode(root, 'circle', Z_FILL)
    })
    const [x0, y0] = translateOf(spider)

    await step(`drag Z spider by (${DX}, ${DY})`, async () => {
      performDrag(spider, DX, DY)
      await waitFor(() => {
        const [x1, y1] = translateOf(spider)
        expect(x1 - x0).toBeCloseTo(DX, 1)
        expect(y1 - y0).toBeCloseTo(DY, 1)
      })
    })
  },
}

// —————————————————————————————————————————————————————————————————————————
// 2. Shift-click adds to selection; a subsequent drag moves the whole set.
//
// zxViewer.js reads `shiftKey` from a closure variable updated by keydown
// listeners on the container div, so we dispatch a KeyboardEvent to toggle
// it before the shift-click, and a keyup after to reset the state.
// The shift-click also calls stopImmediatePropagation which prevents the
// drag gesture from starting on that click — so we then start a fresh
// mousedown on the first spider to drive the drag.
// —————————————————————————————————————————————————————————————————————————

export const ShiftClickMultiDrag: Story = {
  name: '2. Shift-click multi-select, then drag',
  args: { diagram: zxSpiders },
  play: async ({ canvasElement, step }) => {
    const DX = 25
    const DY = 15

    const root = await shadowRootOf(canvasElement)
    const container = root.querySelector('.container')
    if (!container) throw new Error('.container not found')

    let zSpider!: SVGGElement
    let xSpider!: SVGGElement
    await step('wait for Z and X spiders to mount', async () => {
      zSpider = await waitForNode(root, 'circle', Z_FILL)
      xSpider = await waitForNode(root, 'circle', X_FILL)
    })
    const [zx0, zy0] = translateOf(zSpider)
    const [xx0, xy0] = translateOf(xSpider)

    await step('click Z spider to select it', () => {
      fireMouse('mousedown', zSpider, 100, 100)
      fireMouse('mouseup', window, 100, 100)
    })

    await step('shift-click X spider to add it to selection', () => {
      fireKey('keydown', container, true)
      fireMouse('mousedown', xSpider, 200, 100, true)
      fireMouse('mouseup', window, 200, 100, true)
      fireKey('keyup', container, false)
    })

    await step(`drag from Z by (${DX}, ${DY}) and assert both nodes move together`, async () => {
      performDrag(zSpider, DX, DY)
      await waitFor(() => {
        const [zx1, zy1] = translateOf(zSpider)
        const [xx1, xy1] = translateOf(xSpider)
        expect(zx1 - zx0).toBeCloseTo(DX, 1)
        expect(zy1 - zy0).toBeCloseTo(DY, 1)
        expect(xx1 - xx0).toBeCloseTo(DX, 1)
        expect(xy1 - xy0).toBeCloseTo(DY, 1)
      })
    })
  },
}

// —————————————————————————————————————————————————————————————————————————
// 3. H-box drag is constrained to the line between its two chain endpoints.
//
// With a horizontal chain (both spiders on qubit 0), the endpoint vector is
// (ex, 0). d3-drag delivers (dx, dy); the H-box code computes
//   dParam = (dx*ex + dy*ey) / (ex² + ey²)
// so a purely vertical drag (dy≠0, dx=0) yields dParam=0 → no movement.
// A horizontal drag (dx≠0, dy=0) moves the H-box along the line only.
// —————————————————————————————————————————————————————————————————————————

export const HboxConstrainedDrag: Story = {
  name: '3. H-box stays on its chain line under drag',
  args: { diagram: zHzChain },
  play: async ({ canvasElement, step }) => {
    const PERPENDICULAR_DX = 0
    const PERPENDICULAR_DY = 60
    const ALONG_LINE_DX = 30
    const ALONG_LINE_DY = 0

    const root = await shadowRootOf(canvasElement)
    let hbox!: SVGGElement
    await step('wait for H-box to mount', async () => {
      hbox = await waitForNode(root, 'rect', H_FILL)
    })
    const [x0, y0] = translateOf(hbox)

    await step(
      `perpendicular drag by (${PERPENDICULAR_DX}, ${PERPENDICULAR_DY}) is discarded`,
      async () => {
        performDrag(hbox, PERPENDICULAR_DX, PERPENDICULAR_DY)
        await waitFor(() => {
          const [x1, y1] = translateOf(hbox)
          expect(x1).toBeCloseTo(x0, 1)
          expect(y1).toBeCloseTo(y0, 1)
        })
      },
    )

    await step(
      `along-line drag by (${ALONG_LINE_DX}, ${ALONG_LINE_DY}) advances x, keeps y fixed`,
      async () => {
        performDrag(hbox, ALONG_LINE_DX, ALONG_LINE_DY)
        await waitFor(() => {
          const [x2, y2] = translateOf(hbox)
          expect(x2).toBeGreaterThan(x0)
          expect(y2).toBeCloseTo(y0, 1)
        })
      },
    )
  },
}

// —————————————————————————————————————————————————————————————————————————
// 4. Brush-select over multiple nodes, then drag one → the whole set moves.
//
// d3-brush's mousedown lives on the overlay <rect>. Its coordinate math
// goes through getScreenCTM, so we compute clientX/Y from the <svg>'s
// bounding rect (svg unit == css px here — no viewBox scaling).
// —————————————————————————————————————————————————————————————————————————

export const BrushSelectThenDrag: Story = {
  name: '4. Brush-select two spiders, then drag',
  args: { diagram: zxSpiders },
  play: async ({ canvasElement, step }) => {
    const BRUSH_PAD_X = 10
    const BRUSH_PAD_Y = 30
    const DX = 20
    const DY = 20

    const root = await shadowRootOf(canvasElement)
    const svg = root.querySelector<SVGSVGElement>('svg')
    const overlay = root.querySelector<SVGRectElement>('.brush .overlay')
    if (!svg || !overlay) throw new Error('svg/brush overlay not found')

    let zSpider!: SVGGElement
    let xSpider!: SVGGElement
    await step('wait for Z and X spiders to mount', async () => {
      zSpider = await waitForNode(root, 'circle', Z_FILL)
      xSpider = await waitForNode(root, 'circle', X_FILL)
    })
    const [zx0, zy0] = translateOf(zSpider)
    const [xx0, xy0] = translateOf(xSpider)

    await step(
      `brush-select the Z and X spiders (pad ±${BRUSH_PAD_X} x, ±${BRUSH_PAD_Y} y)`,
      () => {
        const rect = svg.getBoundingClientRect()
        const brushMinX = Math.min(zx0, xx0) - BRUSH_PAD_X
        const brushMaxX = Math.max(zx0, xx0) + BRUSH_PAD_X
        const brushMinY = zy0 - BRUSH_PAD_Y
        const brushMaxY = zy0 + BRUSH_PAD_Y

        fireMouse('mousedown', overlay, rect.left + brushMinX, rect.top + brushMinY)
        fireMouse('mousemove', window, rect.left + brushMaxX, rect.top + brushMaxY)
        fireMouse('mouseup', window, rect.left + brushMaxX, rect.top + brushMaxY)
      },
    )

    await step(`drag from Z by (${DX}, ${DY}) and assert both nodes move together`, async () => {
      performDrag(zSpider, DX, DY)
      await waitFor(() => {
        const [zx1, zy1] = translateOf(zSpider)
        const [xx1, xy1] = translateOf(xSpider)
        expect(zx1 - zx0).toBeCloseTo(DX, 1)
        expect(zy1 - zy0).toBeCloseTo(DY, 1)
        expect(xx1 - xx0).toBeCloseTo(DX, 1)
        expect(xy1 - xy0).toBeCloseTo(DY, 1)
      })
    })
  },
}
