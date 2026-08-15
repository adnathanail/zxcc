import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect, waitFor } from 'storybook/test'
import { type DiagramData, ORIGINAL_COLORS } from '../src/zxRender'
import {
  hboxFanout,
  hboxFanoutCollision,
  pauliWebChain,
  singleZSpider,
  zHHzChain,
  zHzChain,
  zxSpiders,
} from './diagrams'
import {
  fireKey,
  fireMouse,
  pathDataIn,
  performDrag,
  shadowRootOf,
  translateOf,
  waitForNode,
  waitForNodes,
} from './interactionHelpers'

interface Args {
  diagram: DiagramData
}

const meta: Meta<Args> = {
  title: 'Interactions',
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

// —————————————————————————————————————————————————————————————————————————
// 5. An H-box that isn't in a chain falls back to barycentre placement.
//
// getHboxChainInfo() only resolves a chain for an H-box of degree exactly 2.
// A degree-3 H-box therefore takes the fallback branch, which parks it at the
// mean of its non-H-box neighbours, nudged north-east by 0.25 * scale.
//
// We assert the *direction* of the nudge rather than its magnitude: deriving
// 0.25 * scale here would just restate the layout maths in the test.
// —————————————————————————————————————————————————————————————————————————

export const HboxBarycentreFallback: Story = {
  name: '5. Degree-3 H-box falls back to barycentre',
  args: { diagram: hboxFanout },
  play: async ({ canvasElement, step }) => {
    const root = await shadowRootOf(canvasElement)

    let hbox!: SVGGElement
    let spiders!: SVGGElement[]
    await step('wait for the H-box and its three spiders to mount', async () => {
      hbox = await waitForNode(root, 'rect', H_FILL)
      spiders = await waitForNodes(root, 'circle', Z_FILL, 3)
    })

    await step('H-box sits north-east of its neighbour barycentre', () => {
      const positions = spiders.map(translateOf)
      const meanX = positions.reduce((a, [x]) => a + x, 0) / positions.length
      const meanY = positions.reduce((a, [, y]) => a + y, 0) / positions.length
      const [hx, hy] = translateOf(hbox)

      // North-east: x nudged positive, y nudged negative (SVG y grows down).
      expect(hx).toBeGreaterThan(meanX)
      expect(hy).toBeLessThan(meanY)
    })
  },
}

// —————————————————————————————————————————————————————————————————————————
// 6. Two fallback H-boxes over identical neighbours can't stack on top of
//    each other.
//
// Both take the barycentre fallback, so both want the same point. Whatever
// the placement does to separate them, the test is the painted result: the
// two squares may not share any pixels.
//
// Only each other: a diagram can put its spiders as close together as it
// likes, so an H-box parked among them is allowed to overlap one.
// —————————————————————————————————————————————————————————————————————————

// Axis-aligned bounds of the shape a node paints, in SVG coordinates. Read off
// the rendered geometry rather than recomputed from scale, so this stays a
// statement about what is on screen. Node <g>s also carry id and phase text,
// which is allowed to overhang and so is deliberately excluded.
function shapeBounds(g: SVGGElement): { x0: number; y0: number; x1: number; y1: number } {
  const [tx, ty] = translateOf(g)
  const rect = g.querySelector('rect')
  if (rect) {
    const x = Number(rect.getAttribute('x'))
    const y = Number(rect.getAttribute('y'))
    return {
      x0: tx + x,
      y0: ty + y,
      x1: tx + x + Number(rect.getAttribute('width')),
      y1: ty + y + Number(rect.getAttribute('height')),
    }
  }
  const circle = g.querySelector('circle')
  if (!circle) throw new Error('node paints neither a rect nor a circle')
  const r = Number(circle.getAttribute('r'))
  return { x0: tx - r, y0: ty - r, x1: tx + r, y1: ty + r }
}

function overlaps(a: ReturnType<typeof shapeBounds>, b: ReturnType<typeof shapeBounds>): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
}

export const HboxBarycentreCollision: Story = {
  name: '6. Colliding fallback H-boxes are nudged apart',
  args: { diagram: hboxFanoutCollision },
  play: async ({ canvasElement, step }) => {
    const root = await shadowRootOf(canvasElement)

    let hboxes!: SVGGElement[]
    await step('wait for both H-boxes to mount', async () => {
      hboxes = await waitForNodes(root, 'rect', H_FILL, 2)
    })

    await step('the two H-boxes do not paint over each other', () => {
      const [a, b] = hboxes.map(shapeBounds)
      expect(overlaps(a, b)).toBe(false)
    })

    await step('and hold that gap as a neighbour spider is dragged', async () => {
      const spiders = await waitForNodes(root, 'circle', Z_FILL, 3)
      const gap = translateOf(hboxes[1])[0] - translateOf(hboxes[0])[0]

      // Uneven steps ending on a barycentre where `(x + clearance) - x` rounds
      // to just under `clearance`: placement has to be a function of where the
      // nodes are, not of how they got there. A separation solved by nudging
      // until clear settles exactly on its own threshold, so at points like
      // this one rounding calls it a collision and nudges a second time —
      // which is the box visibly flicking sideways as a spider is dragged.
      for (const dx of [-40, -50, -67]) {
        performDrag(spiders[1], dx, 0)
        await waitFor(() => {
          const [a, b] = hboxes.map(shapeBounds)
          expect(overlaps(a, b)).toBe(false)
          expect(translateOf(hboxes[1])[0] - translateOf(hboxes[0])[0]).toBeCloseTo(gap, 6)
        })
      }
    })
  },
}

// —————————————————————————————————————————————————————————————————————————
// 7 & 8. In a 2-H-box chain, dragging one H-box clamps against its *neighbour*
// rather than against the chain endpoint. Clamping against the next H-box and
// against the previous one are separate branches, so they get a story each —
// once one H-box has been pinned against the other there is no slack left to
// test the opposite direction in the same diagram.
//
// zHHzChain is Z → H → H → Z on one qubit, so both H-boxes share a line and
// start evenly spaced at lineParam 1/3 and 2/3. The clamp stops each one a
// clearance short of its neighbour, where the clearance is a pixel distance
// derived from the painted shapes rather than a flat fraction of the chain —
// so the boxes come to rest touching at worst, never overlapping.
// —————————————————————————————————————————————————————————————————————————

const OVERSHOOT_DX = 400

// Centre-to-centre distance below which two H-boxes would paint over each
// other. Read off the rendered rect so it tracks node_size, not a literal.
function boxWidthOf(hbox: SVGGElement): number {
  return Number(hbox.querySelector('rect')?.getAttribute('width'))
}

export const HboxChainClampForward: Story = {
  name: '7. Chained H-box clamps against the next H-box',
  args: { diagram: zHHzChain },
  play: async ({ canvasElement, step }) => {
    const root = await shadowRootOf(canvasElement)

    let hboxes!: SVGGElement[]
    await step('wait for both H-boxes to mount', async () => {
      hboxes = await waitForNodes(root, 'rect', H_FILL, 2)
    })

    // Document order is node-id order, so [0] is the left H-box.
    const [leftHbox, rightHbox] = hboxes
    const [leftX0] = translateOf(leftHbox)
    const [rightX0] = translateOf(rightHbox)
    expect(leftX0).toBeLessThan(rightX0)

    await step(
      `drag the left H-box right by ${OVERSHOOT_DX} — far past its neighbour`,
      async () => {
        performDrag(leftHbox, OVERSHOOT_DX, 0)
        await waitFor(() => {
          const [leftX1] = translateOf(leftHbox)
          const [rightX1] = translateOf(rightHbox)
          // It moved...
          expect(leftX1).toBeGreaterThan(leftX0)
          // ...but stopped short of the neighbour instead of sailing past it,
          // and short enough that the two squares don't intersect.
          expect(rightX1 - leftX1).toBeGreaterThanOrEqual(boxWidthOf(leftHbox))
        })
      },
    )
  },
}

export const HboxChainClampBackward: Story = {
  name: '8. Chained H-box clamps against the previous H-box',
  args: { diagram: zHHzChain },
  play: async ({ canvasElement, step }) => {
    const root = await shadowRootOf(canvasElement)

    let hboxes!: SVGGElement[]
    await step('wait for both H-boxes to mount', async () => {
      hboxes = await waitForNodes(root, 'rect', H_FILL, 2)
    })

    const [leftHbox, rightHbox] = hboxes
    const [leftX0] = translateOf(leftHbox)
    const [rightX0] = translateOf(rightHbox)

    await step(
      `drag the right H-box left by ${OVERSHOOT_DX} — back past its neighbour`,
      async () => {
        performDrag(rightHbox, -OVERSHOOT_DX, 0)
        await waitFor(() => {
          const [rightX1] = translateOf(rightHbox)
          // It moved left...
          expect(rightX1).toBeLessThan(rightX0)
          // ...but stopped clear of the left H-box, which hasn't budged.
          expect(rightX1 - leftX0).toBeGreaterThanOrEqual(boxWidthOf(rightHbox))
        })
      },
    )
  },
}

// —————————————————————————————————————————————————————————————————————————
// 9. Pauli-web strands follow their endpoints during a drag.
//
// web_curve() runs from source to the (source, target) midpoint, so moving a
// single endpoint is enough to change the path data of every strand touching
// it. Only strands whose source or target is selected get redrawn.
// —————————————————————————————————————————————————————————————————————————

export const PauliWebFollowsDrag: Story = {
  name: '9. Pauli-web strands redraw on drag',
  args: { diagram: pauliWebChain },
  play: async ({ canvasElement, step }) => {
    const DX = 35
    const DY = 25

    const root = await shadowRootOf(canvasElement)

    let zSpider!: SVGGElement
    await step('wait for the Z spider to mount', async () => {
      zSpider = await waitForNode(root, 'circle', Z_FILL)
    })

    const webBefore = pathDataIn(root, 'web')
    expect(webBefore.length).toBeGreaterThan(0)
    expect(webBefore.every(d => d !== '')).toBe(true)

    await step(`drag the Z spider by (${DX}, ${DY}) and assert strands follow`, async () => {
      performDrag(zSpider, DX, DY)
      await waitFor(() => {
        const webAfter = pathDataIn(root, 'web')
        expect(webAfter.length).toBe(webBefore.length)
        const changed = webAfter.filter((d, i) => d !== webBefore[i])
        expect(changed.length).toBeGreaterThan(0)
      })
    })
  },
}
