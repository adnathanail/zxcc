import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect, waitFor } from 'storybook/test'
import type { DiagramData } from '../../src/index'
import { strongComplementarityOf } from '../diagrams'
import {
  fireMouse,
  performDrag,
  ringedDotsIn,
  selectedBlobsIn,
  shadowRootOf,
  translateOf,
} from '../interactionHelpers'

interface Args {
  diagram: DiagramData
}

const meta: Meta<Args> = {
  title: 'Hypergraphs/Interactions',
  render: ({ diagram }) =>
    html`<zx-diagram
      .diagram=${diagram}
      view-as-hypergraph
      style="min-height: 160px"
    ></zx-diagram>`,
  parameters: {
    docs: {
      description: {
        component:
          'Interaction tests for the hypergraph view: selecting every blob a click falls inside, and dragging a dot so the blobs holding it reshape. Each play function dispatches native MouseEvents and asserts on the rendered SVG.',
      },
    },
  },
}

export default meta

type Story = StoryObj<Args>

// Clicking a hyperedge blob selects every blob that contains the point, not
// just the topmost one — with this diagram all four meet in the middle, and
// the hit test is geometry (`blobContains`) rather than SVG hit-testing for
// exactly that reason.
export const HypergraphBlobSelection: Story = {
  name: '1. Blob selection',
  args: { diagram: strongComplementarityOf(2, 2) },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    const svg = await waitFor(() => {
      const el = root.querySelector<SVGSVGElement>('svg')
      if (!el) throw new Error('hypergraph svg not mounted')
      return el
    })
    // Click points are read off the dots themselves rather than hard-coded,
    // so the assertions survive a change of scale or zoom.
    const box = svg.getBoundingClientRect()
    const clickDot = (wire: string) => {
      const dot = root.querySelector<SVGGElement>(`g[data-wire="${wire}"]`)
      if (!dot) throw new Error(`dot ${wire} not mounted`)
      const [x, y] = translateOf(dot)
      fireMouse('mousedown', svg, box.left + x, box.top + y)
    }

    // Nothing is selected to begin with, so nothing is leadered, and no dot is
    // ringed.
    expect(root.querySelectorAll('line.leader').length).toBe(0)
    expect(ringedDotsIn(root)).toEqual([])

    // w0 is the top-left boundary leg, which only the first Z spider (node 2)
    // holds.
    clickDot('w0')
    await waitFor(() => expect(selectedBlobsIn(root)).toEqual(['e2']))
    // Selecting a blob rings every dot it holds: the outline says which shapes
    // are picked out, but a hull encloses dots it doesn't hold, so on its own it
    // doesn't say which wires are in them. e2 is the first Z spider — its
    // boundary leg and its two wires to the X rank.
    expect(ringedDotsIn(root)).toEqual(['w0', 'w4', 'w5'])
    // The selected blob gets a line from its caption down to its own outline —
    // which caption goes with which shape is the thing four overlapping blobs
    // make unreadable. It starts just under the caption's baseline.
    const leader = root.querySelector<SVGLineElement>('line.leader[data-hyperedge="e2"]')
    const caption = root.querySelector<SVGTextElement>('g[data-hyperedge="e2"] text')
    expect(leader).not.toBeNull()
    expect(Number(leader?.getAttribute('x1'))).toBeCloseTo(Number(caption?.getAttribute('x')), 5)
    expect(Number(leader?.getAttribute('y1'))).toBeGreaterThan(Number(caption?.getAttribute('y')))
    // …and ends below where it starts, on the blob under the caption.
    expect(Number(leader?.getAttribute('y2'))).toBeGreaterThan(Number(leader?.getAttribute('y1')))

    // Every spider has a leg on one of the two crossing wires, and both of
    // those dots sit dead centre — so a click there is inside all four blobs.
    clickDot('w6')
    await waitFor(() => expect(selectedBlobsIn(root)).toEqual(['e2', 'e3', 'e4', 'e5']))
    // One leader each: with the four piled on top of each other, that is what
    // says which of the four captions belongs to which.
    expect(root.querySelectorAll('line.leader').length).toBe(4)

    // A click on bare canvas drops the selection, and the leaders and rings
    // with it.
    fireMouse('mousedown', svg, box.left + 2, box.top + 2)
    await waitFor(() => expect(selectedBlobsIn(root)).toEqual([]))
    expect(root.querySelectorAll('line.leader').length).toBe(0)
    expect(ringedDotsIn(root)).toEqual([])

    // A press that lands on a *dot* selects by membership rather than by
    // geometry: the blobs that hold that wire, which for w6 (the 3—4 crossing
    // wire) is its two endpoints. Clicking the same spot as bare canvas picked
    // out all four above, because the middle of this diagram falls inside every
    // outline — but e2 and e5 do not hold w6, and where their hulls happen to
    // fall is an accident of the layout rather than something about the
    // hypergraph.
    const dot = root.querySelector<SVGGElement>('g[data-wire="w6"]')
    if (!dot) throw new Error('dot w6 not mounted')
    const [x, y] = translateOf(dot)
    fireMouse('mousedown', dot, box.left + x, box.top + y)
    await waitFor(() => expect(selectedBlobsIn(root)).toEqual(['e3', 'e4']))
    // Pressing a dot is how you ask what shares a hyperedge with a wire: the
    // rings are on every wire of the two spiders w6 joins — w6 itself, the
    // other Z leg and the other X leg of each — and on nothing else.
    expect(ringedDotsIn(root)).toEqual(['w1', 'w2', 'w4', 'w6', 'w7'])
    fireMouse('mouseup', window, box.left + x, box.top + y)
  },
}

// Dragging a dot is what makes the view explorable: blobs are derived from the
// dot positions on every render, so a dot that moves reshapes every blob
// holding it. Only the blob holding the dragged wire is asserted on — whether
// the *other* blobs move too depends on the outline algorithm, and this is
// about the dragging.
export const HypergraphDotDrag: Story = {
  name: '2. Dot drag',
  args: { diagram: strongComplementarityOf(2, 2) },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    const dotFor = async (wire: string) =>
      waitFor(() => {
        const g = root.querySelector<SVGGElement>(`g[data-wire="${wire}"]`)
        if (!g) throw new Error(`dot ${wire} not mounted`)
        return g
      })
    const outlineOf = (blob: string) =>
      root.querySelector<SVGPathElement>(`g[data-hyperedge="${blob}"] path`)?.getAttribute('d')

    // How many blob outlines w5's red mark is clipped to — i.e. how many blobs
    // it has strayed into.
    const clipCount = () => root.querySelector('clipPath[id$="-w5"]')?.children.length ?? 0

    const tallyAt = () => {
      const t = root.querySelector<SVGTextElement>('svg text.tally')
      return t && { text: t.textContent, at: [t.getAttribute('x'), t.getAttribute('y')] }
    }

    const [x, y] = translateOf(await dotFor('w6'))
    const before = outlineOf('e3')
    // The diagram already has trespasses at rest, so the tally is on screen
    // before the drag starts — which is what makes it possible to check that
    // dragging doesn't shift it.
    const tallyBefore = tallyAt()
    if (!tallyBefore) throw new Error('no tally before the drag')

    performDrag(await dotFor('w6'), 30, -20)

    await waitFor(async () => expect(translateOf(await dotFor('w6'))).toEqual([x + 30, y - 20]))
    // e3 is the blob for node 3, one of the two spiders w6 joins.
    expect(outlineOf('e3')).not.toEqual(before)
    // The press picked out the blobs holding w6 on the way in, so the two being
    // reshaped are the two highlighted — a drag doesn't have to end for the
    // selection to happen, and never selects the blobs w6 merely sits inside.
    expect(selectedBlobsIn(root)).toEqual(['e3', 'e4'])

    // Dragging w6 out of the middle drags e3 across w5 — the other crossing
    // wire, which e3 does not hold — and swallows it whole. The red mark is
    // what says so: it is clipped to the outline of the one blob strayed into,
    // so what goes red is exactly the part of the dot that is somewhere it
    // shouldn't be. Asserted by sampling w5's rim against e3's rendered outline
    // — the same `d` the mark is clipped to, so this is the shape on screen
    // rather than a second calculation of it.
    const mark = root.querySelector<SVGCircleElement>('g.overlap circle[data-wire="w5"]')
    if (!mark) throw new Error('w5 is not marked as overlapping anything')
    expect(clipCount()).toBe(1)

    const cx = Number(mark.getAttribute('cx'))
    const cy = Number(mark.getAttribute('cy'))
    const r = Number(mark.getAttribute('r'))
    const rim = Array.from({ length: 24 }, (_, i) => {
      const angle = (i / 24) * 2 * Math.PI
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
    })
    const insideOf = (blob: string) => {
      const path = root.querySelector<SVGPathElement>(`g[data-hyperedge="${blob}"] path`)
      if (!path) throw new Error(`blob ${blob} not mounted`)
      return rim.filter(p => path.isPointInFill(p)).length
    }
    expect(insideOf('e3')).toBe(rim.length)

    // The count is derived from the same set the red marks are, so it follows a
    // drag. Its position doesn't: that comes from where the layout put the dots
    // rather than where they have been dragged to, so the caption stays put
    // while the drawing under it moves.
    const tally = tallyAt()
    const marks = root.querySelectorAll('g.overlap circle[data-wire]').length
    expect(tally?.text).toBe(`${marks} trespassing node${marks === 1 ? '' : 's'}`)
    expect(tally?.at).toEqual(tallyBefore.at)
  },
}
