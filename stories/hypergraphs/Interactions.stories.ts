import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect, waitFor } from 'storybook/test'
import type { DiagramData } from '../../src/index'
import { fourSpiderSquare, strongComplementarityOf } from '../diagrams'
import {
  fireMouse,
  performDrag,
  ringedDotsIn,
  selectedBlobsIn,
  selectedLinksIn,
  selectedNodesIn,
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
      view-mode="hypergraph"
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
    const dotFor = (wire: string) => {
      const dot = root.querySelector<SVGGElement>(`g[data-wire="${wire}"]`)
      if (!dot) throw new Error(`dot ${wire} not mounted`)
      return translateOf(dot)
    }
    const clickDot = (wire: string) => {
      const [x, y] = dotFor(wire)
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
    // The press landed on the blob, so the blob is what it *named* and is drawn
    // solid; the dots only follow from it, and are drawn dashed. One press
    // reaches a whole neighbourhood, and this is what keeps the thing pointed
    // at from being lost in it.
    expect(selectedBlobsIn(root, 'named')).toEqual(['e2'])
    expect(ringedDotsIn(root, 'named')).toEqual([])
    expect(ringedDotsIn(root, 'implied')).toEqual(['w0', 'w4', 'w5'])
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

    // The crossing wires 2—5 and 3—4 have the same midpoint, and the layout
    // slides each along its own wire until they read as two marks. Distinct
    // isn't enough to assert: two dots a pixel apart are still one blot, so the
    // check is that they clear a whole dot diameter, which is the property the
    // spreading is for.
    const [ax, ay] = dotFor('w5')
    const [bx, by] = dotFor('w6')
    const radius = Number(root.querySelector('g[data-wire="w6"] circle')?.getAttribute('r') ?? 0)
    expect(radius).toBeGreaterThan(0)
    expect(Math.hypot(ax - bx, ay - by)).toBeGreaterThan(2 * radius)
    // They part sideways, across the gap between the two ranks, rather than
    // down the column they share: sliding a dot along its own wire is what
    // makes the spread two-dimensional, and the column is the one direction
    // that is already full of other dots.
    expect(Math.abs(ax - bx)).toBeGreaterThan(Math.abs(ay - by))

    // w6 is a leg of both spiders it joins, and once slid it lies inside the
    // hulls of the other two as well — the blobs overlap in the middle of this
    // diagram whatever the dots do, which is a separate problem from whether
    // two dots are drawn on one spot.
    clickDot('w6')
    await waitFor(() => expect(selectedBlobsIn(root)).toEqual(['e2', 'e3', 'e4', 'e5']))
    // One leader each: with the four piled on top of each other, that is what
    // says which of the captions belongs to which.
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
    // out all four above, because w6 lies inside e2's and e5's hulls too — but
    // neither holds w6, and where their hulls happen to fall is an accident of the
    // layout rather than something about the hypergraph.
    const dot = root.querySelector<SVGGElement>('g[data-wire="w6"]')
    if (!dot) throw new Error('dot w6 not mounted')
    const [x, y] = translateOf(dot)
    fireMouse('mousedown', dot, box.left + x, box.top + y)
    await waitFor(() => expect(selectedBlobsIn(root)).toEqual(['e3', 'e4']))
    // Pressing a dot is how you ask what shares a hyperedge with a wire: the
    // rings are on every wire of the two spiders w6 joins — w6 itself, the
    // other Z leg and the other X leg of each — and on nothing else.
    expect(ringedDotsIn(root)).toEqual(['w1', 'w2', 'w4', 'w6', 'w7'])
    // Here the press named the *dot*, so w6 alone is solid and everything the
    // question dragged in with it — the two blobs, and the four other wires
    // they hold — is dashed. The answer to "what shares a hyperedge with w6"
    // stays distinguishable from w6 itself.
    expect(ringedDotsIn(root, 'named')).toEqual(['w6'])
    expect(ringedDotsIn(root, 'implied')).toEqual(['w1', 'w2', 'w4', 'w7'])
    expect(selectedBlobsIn(root, 'named')).toEqual([])
    expect(selectedBlobsIn(root, 'implied')).toEqual(['e3', 'e4'])
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

    performDrag(await dotFor('w6'), -45, -10)

    // Compared to a tolerance rather than exactly: a slid dot no longer lands
    // on a whole pixel, and the viewer adds the pointer's travel as
    // `origin + move - start` where this adds `origin + delta`. Those differ in
    // the last bit of a double, which says nothing about whether the drag
    // worked.
    await waitFor(async () => {
      const [dx, dy] = translateOf(await dotFor('w6'))
      expect(dx).toBeCloseTo(x - 45, 6)
      expect(dy).toBeCloseTo(y - 10, 6)
    })
    // e3 is the blob for node 3, one of the two spiders w6 joins.
    expect(outlineOf('e3')).not.toEqual(before)
    // The press picked out the blobs holding w6 on the way in, so the two being
    // reshaped are the two highlighted — a drag doesn't have to end for the
    // selection to happen, and never selects the blobs w6 merely sits inside.
    expect(selectedBlobsIn(root)).toEqual(['e3', 'e4'])

    // Dragging w6 reshapes the two blobs holding it, and both end up swallowing
    // part of w5 — the other crossing wire, which neither of them holds. That is
    // a *partial* trespass, which is what the red mark is for: it is clipped to
    // the outlines of the blobs strayed into, both of them at once, so what goes
    // red is exactly the part of the dot that is somewhere it shouldn't be, and
    // a dot half inside comes out half red.
    const mark = root.querySelector<SVGCircleElement>('g.overlap circle[data-wire="w5"]')
    if (!mark) throw new Error('w5 is not marked as overlapping anything')
    expect(clipCount()).toBe(2)

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
    // Sampled against the blobs' rendered outlines — the same `d` the mark is
    // clipped to, so this is the shape on screen rather than a second
    // calculation of it — and found partly in and partly out of each.
    for (const blob of ['e3', 'e4']) {
      expect(insideOf(blob)).toBeGreaterThan(0)
      expect(insideOf(blob)).toBeLessThan(rim.length)
    }

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

/**
 * With both views up, a selection is one thing seen twice: `<zx-diagram>` holds
 * it in the diagram's own terms — ZX node ids and edge indices — and each
 * painter draws whatever that means in its picture. So a press in either view
 * lands in both, and the pairs it draws are what the dual *is*.
 *
 * The four cases, one per press below: a spider is a blob; a boundary is no
 * hyperedge at all, so all it has over there is the dot of the wire it hangs
 * off; a blob is a spider; and a dot is an edge.
 */
export const LinkedSelection: StoryObj<Args> = {
  name: '3. Selection across both views',
  args: { diagram: fourSpiderSquare },
  render: ({ diagram }) =>
    html`<zx-diagram .diagram=${diagram} view-mode="both" style="min-height: 160px"></zx-diagram>`,
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    const svg = await waitFor(() => {
      const el = root.querySelector<SVGSVGElement>('zx-hypergraph-viewer svg')
      if (!el) throw new Error('hypergraph svg not mounted')
      return el
    })
    const nodeFor = (id: number) => {
      const g = root.querySelector<SVGGElement>(`zx-viewer g[data-node="${id}"]`)
      if (!g) throw new Error(`node ${id} not mounted`)
      return g
    }
    const dotFor = (wire: string) => {
      const g = root.querySelector<SVGGElement>(`zx-hypergraph-viewer g[data-wire="${wire}"]`)
      if (!g) throw new Error(`dot ${wire} not mounted`)
      return g
    }
    // A press is enough to select; the release ends the drag the viewers start
    // on the way in, so it can't run on into the next case.
    const press = (target: Element, x: number, y: number) => {
      fireMouse('mousedown', target, x, y)
      fireMouse('mouseup', window, x, y)
    }
    const pressNode = (id: number) => {
      const [x, y] = translateOf(nodeFor(id))
      press(nodeFor(id), x, y)
    }

    // Spider 2 in the diagram picks out the blob standing for it, and rings
    // every dot that blob holds — the wires incident to that spider, which is
    // what the hyperedge *is*. Its own boundary leg w0 and its two wires into
    // the square.
    pressNode(2)
    await waitFor(() => expect(selectedBlobsIn(root)).toEqual(['e2']))
    expect(ringedDotsIn(root)).toEqual(['w0', 'w2', 'w3'])
    expect(selectedNodesIn(root)).toEqual([2])
    // The blob *is* the node that was pressed, drawn in the other view, so it
    // is solid; its dots only follow, so they are dashed.
    expect(selectedBlobsIn(root, 'named')).toEqual(['e2'])
    expect(ringedDotsIn(root, 'implied')).toEqual(['w0', 'w2', 'w3'])

    // Input 0 is a boundary, so it is no hyperedge and has no blob: nothing is
    // outlined. What it does have over there is the dot for the wire it hangs
    // off, and that alone is ringed.
    pressNode(0)
    await waitFor(() => expect(ringedDotsIn(root)).toEqual(['w0']))
    expect(selectedBlobsIn(root)).toEqual([])
    expect(selectedNodesIn(root)).toEqual([0])
    // Dashed, not solid: the selection names the boundary, and the dot is the
    // nearest thing this view has to it rather than the thing itself.
    expect(ringedDotsIn(root, 'named')).toEqual([])

    // Back the other way. A press on the hypergraph canvas selects by geometry
    // — every blob the point falls inside — and each of those names its spider,
    // so the diagram picks out exactly the nodes those blobs stand for. The
    // point is the midpoint of two of e2's dots, which is inside its hull and
    // clear of both.
    const box = svg.getBoundingClientRect()
    const [ax, ay] = translateOf(dotFor('w0'))
    const [bx, by] = translateOf(dotFor('w2'))
    press(svg, box.left + (ax + bx) / 2, box.top + (ay + by) / 2)
    await waitFor(() => expect(selectedBlobsIn(root)).toContain('e2'))
    // Whatever the point hit, the diagram's selection is those blobs' nodes —
    // asserted against what came out rather than a fixed list, since which
    // hulls overlap a spot is a fact about the drawing.
    expect(selectedNodesIn(root)).toEqual(
      selectedBlobsIn(root)
        .map(id => Number(id.slice(1)))
        .sort((a, b) => a - b),
    )

    // A press on a *dot* names the edge instead: the dot is that edge, so what
    // lights up in the diagram is the wire, not the spiders at its ends. w0 is
    // the first edge, 0—2. The blobs holding it are still outlined here — that
    // is the question this view answers about a wire — but they are derived
    // from the edge rather than named by it, which is why no spider is picked
    // out over there.
    press(dotFor('w0'), box.left + ax, box.top + ay)
    await waitFor(() => expect(selectedLinksIn(root)).toEqual([0]))
    expect(selectedNodesIn(root)).toEqual([])
    expect(selectedBlobsIn(root)).toEqual(['e2'])
    // …and the dot pressed is the solid one, with the blob it reached dashed.
    expect(ringedDotsIn(root, 'named')).toEqual(['w0'])
    expect(selectedBlobsIn(root, 'implied')).toEqual(['e2'])
    // The edge is *cased*, not recoloured: the blue goes underneath, on its own
    // path, and the wire keeps the colour that says what kind of edge it is.
    const wire = root.querySelectorAll<SVGPathElement>('zx-viewer g.link path')[0]
    const casing = root.querySelector<SVGPathElement>('zx-viewer g.casing path[data-link="0"]')
    expect(wire.getAttribute('stroke')).toBe('#000000')
    expect(casing?.getAttribute('d')).toBe(wire.getAttribute('d'))
    expect(casing?.getAttribute('stroke')).toBe('#00f')
    // …and it stands off the wire: a band of canvas over the middle of the
    // casing is what leaves blue on either side rather than under.
    const gap = root.querySelector<SVGPathElement>('zx-viewer g.casing path.gap')
    expect(gap?.getAttribute('stroke')).toBe('#fcfcfd')
    expect(gap?.getAttribute('d')).toBe(wire.getAttribute('d'))
  },
}
