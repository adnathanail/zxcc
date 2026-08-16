import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect, waitFor } from 'storybook/test'
import type { DiagramData } from '../../src/index'
import { strongComplementarity } from '../diagrams'
import {
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
    const clickDot = (wire: string) => {
      const dot = root.querySelector<SVGGElement>(`g[data-wire="${wire}"]`)
      if (!dot) throw new Error(`dot ${wire} not mounted`)
      const [x, y] = translateOf(dot)
      fireMouse('mousedown', svg, box.left + x, box.top + y)
    }

    // w0 is the top-left boundary leg, which only the first Z spider holds.
    clickDot('w0')
    await waitFor(() => expect(selectedBlobsIn(root)).toEqual(['e1']))

    // Every spider has a leg on one of the two crossing wires, and both of
    // those dots sit dead centre — so a click there is inside all four blobs.
    clickDot('w6')
    await waitFor(() => expect(selectedBlobsIn(root)).toEqual(['e1', 'e2', 'e5', 'e6']))

    // A click on bare canvas drops the selection.
    fireMouse('mousedown', svg, box.left + 2, box.top + 2)
    await waitFor(() => expect(selectedBlobsIn(root)).toEqual([]))
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

    const [x, y] = translateOf(await dotFor('w6'))
    const before = outlineOf('e1')

    performDrag(await dotFor('w6'), 30, -20)

    await waitFor(async () => expect(translateOf(await dotFor('w6'))).toEqual([x + 30, y - 20]))
    // e1 is the blob for node 1, one of the two spiders w6 joins.
    expect(outlineOf('e1')).not.toEqual(before)
  },
}
