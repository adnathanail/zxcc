// Stories that exist for their play function rather than for their picture, and
// so opt out of the visual diff (`chromatic: { disableSnapshot: true }` on the
// `meta` below, which covers the whole group).

import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect, waitFor } from 'storybook/test'
import {
  type DiagramData,
  type HypergraphInput,
  VIEW_MODES,
  type ZxDiagramElement,
} from '../../src/index'
import { fourSpiderSquare } from '../diagrams'
import {
  blobIdsIn,
  dotIdsIn,
  firePointer,
  ringedDotsIn,
  selectedBlobsIn,
  selectedNodesIn,
  shadowRootOf,
  translateOf,
} from '../interactionHelpers'

const meta: Meta = {
  title: 'Other/Tests',
  parameters: {
    chromatic: { disableSnapshot: true },
    docs: {
      description: {
        component:
          'Assertions rather than pictures — a message, or a repaint, rather than a drawing worth looking at. Nothing here is snapshotted.',
      },
    },
  },
}

export default meta

type Story = StoryObj

/** The six ways the public elements refuse to draw, in one story.
 *
 * They are together rather than one apiece because the error UI is the same
 * `<pre>` and Retry button in all six and the *message* is the whole of what
 * is being tested — six stories would be six views of the same grey box.
 *
 * Which element reports one follows which element worked it out. `<zx-diagram>`
 * derives the dual, so a diagram the dual can't be built from is its error; the
 * diagram's own layout belongs to the `<zx-graph>` it mounts, and that is where
 * a malformed diagram is caught. Either way it is the same box in the same
 * place on the page, which is the point of the three sharing a host.
 */
export const ErrorStates: Story = {
  name: 'Error states',
  parameters: {
    docs: {
      story: {
        description:
          'Six failures, one under the other: a malformed diagram, a diagram carrying a node the dual has no shape for, a `view-mode` that is not one of the four, a hypergraph naming a blob shape that does not exist, one whose wire is held by three hyperedges, and one whose wire is only half placed. Each is reported rather than drawn around — an unknown `view-mode` in particular has no mode to fall back *to* that would not be a guess at which was meant, so it says so instead of quietly drawing the graph.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 0.5rem">
      <zx-diagram id="malformed" .diagram=${{ edges: [] } as unknown as DiagramData}></zx-diagram>
      <zx-diagram
        id="no-blob"
        view-mode="hypergraph"
        .diagram=${
          {
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
          } as DiagramData
        }
      ></zx-diagram>
      <zx-diagram id="bad-mode" view-mode="both" .diagram=${fourSpiderSquare}></zx-diagram>
      <zx-hypergraph
        id="bad-kind"
        .hypergraph=${
          {
            wires: [{ col: 0, qubit: 0 }],
            hyperedges: [
              { kind: 'zspider', wires: [0] },
              { kind: 'boundary', wires: [0] },
            ],
          } as unknown as HypergraphInput
        }
      ></zx-hypergraph>
      <zx-hypergraph
        id="over-held"
        .hypergraph=${
          {
            wires: [{ col: 0, qubit: 0 }],
            hyperedges: [
              { kind: 'z-spider', wires: [0] },
              { kind: 'x-spider', wires: [0] },
              { kind: 'z-spider', wires: [0] },
            ],
          } as HypergraphInput
        }
      ></zx-hypergraph>
      <zx-hypergraph
        id="half-placed"
        .hypergraph=${
          {
            wires: [{ col: 0 }],
            hyperedges: [
              { kind: 'z-spider', wires: [0] },
              { kind: 'boundary', wires: [0] },
            ],
          } as unknown as HypergraphInput
        }
      ></zx-hypergraph>
    </div>
  `,
  play: async ({ canvasElement }) => {
    // Each case reports through the same UI, and reports *instead of* drawing:
    // an element in the error state has no painter mounted at all.
    const messageOf = async (id: string) => {
      const root = await shadowRootOf(canvasElement, `#${id}`)
      const text = await waitFor(() => {
        const pre = root.querySelector('.error pre')
        if (!pre?.textContent) throw new Error(`#${id} is not showing an error`)
        return pre.textContent
      })
      expect(root.querySelector('.error button')?.textContent).toBe('Retry')
      expect(root.querySelectorAll('zx-viewer, zx-hypergraph-viewer').length).toBe(0)
      return text
    }

    // 1. A diagram with no `nodes` at all. The message is whatever the engine
    // says about the missing field, so only the field name is pinned.
    expect(await messageOf('malformed')).toContain('nodes')

    // 2. A node with no blob shape. `toHypergraph` names the node and its type
    // rather than picking a colour for something it can't draw — and the same
    // diagram draws fine in `graph`, which is what makes naming the view worth
    // it.
    expect(await messageOf('no-blob')).toBe(
      "Hypergraph view: node 2 is a 'z-box', only 'spider', 'hadamard', 'input' " +
        "and 'output' nodes can be drawn as hyperedges.",
    )

    // 3. `both` is the plausible typo — there are two `both` modes and neither
    // is called that. The message names the value it was given and lists every
    // mode there is, built from the same array the check reads.
    expect(await messageOf('bad-mode')).toBe(
      `Unknown view-mode 'both'. Expected one of: ${VIEW_MODES.join(', ')}.`,
    )

    // 4. A hypergraph naming a blob shape there isn't. Unchecked it would come
    // out the colour of a boundary, since that is what the palette lookup falls
    // back to — a picture that is wrong rather than absent.
    expect(await messageOf('bad-kind')).toBe(
      "Hypergraph input: hyperedge 0 has kind 'zspider', expected one of z-spider, " +
        'x-spider, hadamard, boundary.',
    )

    // 5. A wire held by three ends. A dot *is* an edge, and an edge has two
    // ends: `src` and `tgt` are what is at them, which is how a press on it
    // answers in the diagram's terms, so a third has nowhere to go. One end is
    // allowed and is not an error — that is what is left of a boundary leg when
    // the boundary is neither drawn nor named in `boundaries`.
    expect(await messageOf('over-held')).toBe(
      'Hypergraph input: wire 0 is held by 3 ends, and every wire is held by one or ' +
        'two — one per end of the edge it stands for, or the same hyperedge twice for a ' +
        'self-loop. A boundary left out of `hyperedges` counts as an end if it is named in ' +
        "`boundaries`, which is how a leg keeps both of its ends when its blob isn't drawn.",
    )

    // 6. Half a position. A wire goes either in a grid square (`col`/`qubit`)
    // or at a pixel (`x`/`y`), and the missing half of either would silently
    // become the top-left rather than the position that was meant.
    expect(await messageOf('half-placed')).toBe(
      'Hypergraph input: wire 0 sits at column 0, qubit undefined, and a wire is positioned ' +
        'either on the grid (`col` and `qubit`) or in pixels (`x` and `y`) — both numbers, ' +
        'and one pair or the other.',
    )
  },
}

/**
 * An identity wire — an input joined straight to an output — with the boundary
 * blobs dropped. Both of the wire's ends are boundaries, so this is the one
 * diagram where dropping them leaves a dot with no blob anywhere near it.
 *
 * A picture of a single dot is not worth a snapshot, but two things about it
 * are worth pinning. It draws at all: a wire whose ends are neither drawn nor
 * named would be a wire held by nothing, which the builder refuses. And the
 * selection still crosses — the boundaries are named in the input's
 * `boundaries`, so the dot knows the nodes at its ends even though neither has
 * a blob, and pressing the input over in the diagram rings it.
 */
export const IdentityWireWithoutBoundaryBlobs: Story = {
  name: 'Identity wire with the boundary blobs dropped',
  parameters: {
    docs: {
      story: {
        description:
          'An input wired straight to an output, drawn with `disable-io-blobs-in-hypergraph`. Both ends of the one wire are boundaries, so the dual is a single dot with no blob at either end — and pressing the input in the diagram still rings it, since a dot answers a selection with the nodes at its ends rather than with the blobs around it.',
      },
    },
  },
  render: () => html`
    <zx-diagram
      view-mode="both-vertical"
      disable-io-blobs-in-hypergraph
      .diagram=${
        {
          nodes: [
            { id: 0, type: 'input', ioId: 0 },
            { id: 1, type: 'output', ioId: 0 },
          ],
          edges: [{ src: 0, tgt: 1 }],
        } as DiagramData
      }
    ></zx-diagram>
  `,
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    // Drawn rather than reported: the pair is on screen and the error box is
    // not.
    await waitFor(() => expect(dotIdsIn(root)).toEqual(['w0']))
    expect(root.querySelector('.error pre')).toBe(null)
    expect(blobIdsIn(root)).toEqual([])

    // The input is still a node to press in the diagram, and the dot is still
    // at its end, so it is ringed — dashed, since the selection named the node
    // rather than the wire.
    const input = root.querySelector<SVGGElement>('zx-viewer g[data-node="0"]')
    if (!input) throw new Error('input 0 not mounted')
    const [x, y] = translateOf(input)
    firePointer('pointerdown', input, x, y)
    firePointer('pointerup', window, x, y)
    await waitFor(() => expect(selectedNodesIn(root)).toEqual([0]))
    expect(selectedBlobsIn(root)).toEqual([])
    expect(ringedDotsIn(root, 'implied')).toEqual(['w0'])
  },
}

/** `refresh()` is the escape hatch for a `diagram` mutated in place: the
 *  property still points at the same object, so there is nothing for Lit to
 *  notice and the repaint has to be asked for. This pins both halves — that
 *  the mutation alone paints nothing, and that `refresh()` paints it.
 */
export const InPlaceRefresh: Story = {
  name: 'refresh() after mutating a diagram in place',
  parameters: {
    docs: {
      story: {
        description:
          'A wire is grown into two either side of a new spider by pushing onto the arrays of the diagram already assigned, then `refresh()` is called. The picture is a three-node chain until that call and a four-node chain after it.',
      },
    },
  },
  render: () => html`
    <zx-diagram
      .diagram=${
        {
          nodes: [
            { id: 0, type: 'input', ioId: 0 },
            { id: 1, type: 'spider', color: 'Z', phase: '0' },
            { id: 2, type: 'output', ioId: 0 },
          ],
          edges: [
            { src: 0, tgt: 1 },
            { src: 1, tgt: 2 },
          ],
        } as DiagramData
      }
    ></zx-diagram>
  `,
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    const el = canvasElement.querySelector<ZxDiagramElement>('zx-diagram')
    const diagram = el?.diagram
    if (!el || !diagram) throw new Error('zx-diagram is not holding a diagram')

    const nodeCount = () => root.querySelectorAll('svg g.node > g[data-node]').length
    await waitFor(() => expect(nodeCount()).toBe(3))

    // Splice an X spider into the wire out of the Z one. Every write here is to
    // the object the property already holds, so `diagram` never changes
    // identity and Lit has nothing to react to.
    diagram.nodes.push({ id: 3, type: 'spider', color: 'X', phase: '0' })
    diagram.edges[1].tgt = 3
    diagram.edges.push({ src: 3, tgt: 2 })
    await el.updateComplete
    expect(nodeCount()).toBe(3)

    el.refresh()
    await el.updateComplete
    expect(nodeCount()).toBe(4)
  },
}
