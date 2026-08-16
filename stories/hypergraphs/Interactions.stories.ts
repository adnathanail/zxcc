import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect, waitFor } from 'storybook/test'
import type { DiagramData } from '../../src/index'
import { fourSpiderSquare, strongComplementarity } from '../diagrams'
import {
  expectBlobBreathingRoom,
  expectBlobMembership,
  fireMouse,
  performDrag,
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
  args: { diagram: strongComplementarity },
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
    const dotFor = (wire: string) => {
      const dot = root.querySelector<SVGGElement>(`g[data-wire="${wire}"]`)
      if (!dot) throw new Error(`dot ${wire} not mounted`)
      return translateOf(dot)
    }
    const clickDot = (wire: string) => {
      const [x, y] = dotFor(wire)
      fireMouse('mousedown', svg, box.left + x, box.top + y)
    }

    // Nothing is selected to begin with, so nothing is leadered.
    expect(root.querySelectorAll('line.leader').length).toBe(0)

    // w0 is the top-left boundary leg, which only the first Z spider holds.
    clickDot('w0')
    await waitFor(() => expect(selectedBlobsIn(root)).toEqual(['e1']))
    // The selected blob gets a line from its caption down to its own outline —
    // which caption goes with which shape is the thing four overlapping blobs
    // make unreadable. It starts just under the caption's baseline.
    const leader = root.querySelector<SVGLineElement>('line.leader[data-hyperedge="e1"]')
    const caption = root.querySelector<SVGTextElement>('g[data-hyperedge="e1"] text')
    expect(leader).not.toBeNull()
    expect(Number(leader?.getAttribute('x1'))).toBeCloseTo(Number(caption?.getAttribute('x')), 5)
    expect(Number(leader?.getAttribute('y1'))).toBeGreaterThan(Number(caption?.getAttribute('y')))
    // …and ends below where it starts, on the blob under the caption.
    expect(Number(leader?.getAttribute('y2'))).toBeGreaterThan(Number(leader?.getAttribute('y1')))

    // The crossing wires 1—6 and 2—5 have the same midpoint, and the layout
    // spreads a tie like that apart. Were it to regress they would be one dot,
    // and the click below would land inside all four blobs instead of three.
    expect(dotFor('w6')).not.toEqual(dotFor('w7'))

    // w6 is the wire from node 1 to node 6, so its dot is inside exactly the
    // two blobs standing for those spiders — the whole claim of the view. A
    // hull would have put it inside all four.
    clickDot('w6')
    await waitFor(() => expect(selectedBlobsIn(root)).toEqual(['e1', 'e6']))
    // One leader each: with the two piled on top of each other, that is what
    // says which of the captions belongs to which.
    expect(root.querySelectorAll('line.leader').length).toBe(2)

    // A click on bare canvas drops the selection, and the leaders with it.
    fireMouse('mousedown', svg, box.left + 2, box.top + 2)
    await waitFor(() => expect(selectedBlobsIn(root)).toEqual([]))
    expect(root.querySelectorAll('line.leader').length).toBe(0)

    // A press that lands on a *dot* selects by membership rather than by
    // geometry: the blobs that hold that wire, which for w6 (the 1—6 crossing
    // wire) is its two endpoints. The two tests stay distinct — one asks what
    // is here, the other what this wire is part of — but now that the outline
    // is cut back around dots it doesn't hold, they agree on w6 rather than the
    // geometry over-reporting.
    const dot = root.querySelector<SVGGElement>('g[data-wire="w6"]')
    if (!dot) throw new Error('dot w6 not mounted')
    const [x, y] = translateOf(dot)
    fireMouse('mousedown', dot, box.left + x, box.top + y)
    await waitFor(() => expect(selectedBlobsIn(root)).toEqual(['e1', 'e6']))
    fireMouse('mouseup', window, box.left + x, box.top + y)

    expectBlobMembership(root, strongComplementarity)
    expectBlobBreathingRoom(root)
  },
}

// The invariant on its own, on the other diagram where the blobs pile up: four
// spiders in a square, every dot shared by two of them.
export const HypergraphBlobMembership: Story = {
  name: '3. Blob membership',
  args: { diagram: fourSpiderSquare },
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    await waitFor(() => {
      if (!root.querySelector('svg g.blob path')) throw new Error('blobs not mounted')
    })
    expectBlobMembership(root, fourSpiderSquare)
    expectBlobBreathingRoom(root)
  },
}

// Dragging a dot is what makes the view explorable: blobs are derived from the
// dot positions on every render, so a dot that moves reshapes every blob
// holding it. Only the blob holding the dragged wire is asserted on — whether
// the *other* blobs move too depends on the outline algorithm, and this is
// about the dragging.
export const HypergraphDotDrag: Story = {
  name: '2. Dot drag',
  args: { diagram: strongComplementarity },
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

    const tallyAt = () => {
      const t = root.querySelector<SVGTextElement>('svg text.tally')
      return t && { text: t.textContent, at: [t.getAttribute('x'), t.getAttribute('y')] }
    }

    const [x, y] = translateOf(await dotFor('w6'))
    const before = outlineOf('e1')
    // At rest the outline dodges every dot it doesn't hold, so nothing is
    // trespassing and there is no tally to show.
    expect(tallyAt()).toBeNull()

    performDrag(await dotFor('w6'), 30, -20)

    await waitFor(async () => expect(translateOf(await dotFor('w6'))).toEqual([x + 30, y - 20]))
    // e1 is the blob for node 1, one of the two spiders w6 joins.
    expect(outlineOf('e1')).not.toEqual(before)
    // The press picked out the blobs holding w6 on the way in, so the two being
    // reshaped are the two highlighted — a drag doesn't have to end for the
    // selection to happen, and never selects the blobs w6 merely sits inside.
    expect(selectedBlobsIn(root)).toEqual(['e1', 'e6'])

    // The reshaping is where the outline earns its keep. Dragging w6 across the
    // picture pulls e6's boundary after it, past dots e6 does not hold — and the
    // cut has to keep dodging them as it goes, not just in the pose the layout
    // happened to produce. This is the invariant checked under strain, which is
    // what dragging is for.
    expectBlobMembership(root, strongComplementarity)
    expectBlobBreathingRoom(root)

    // The red marks are a finer test than membership, and a drag is what
    // separates the two. Membership asks where a dot's *centre* is; a mark asks
    // whether the circle you can see overlaps an outline at all, which is
    // `blobContains` with the standoff fattened by a dot's radius. Dragging w6
    // pulls boundaries up against dots they clear by less than that, so the
    // marks come back while every centre is still where it belongs — the
    // drawing reporting that it is close to claiming something untrue, rather
    // than that it has.
    const marked = root.querySelectorAll('g.overlap circle[data-wire]')
    expect(marked.length).toBeGreaterThan(0)

    // The count is derived from the same set the red marks are, so it follows
    // the drag that created them.
    expect(tallyAt()?.text).toBe(`${marked.length} trespassing nodes`)
  },
}
