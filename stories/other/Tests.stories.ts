// Stories that exist for their play function rather than for their picture, and
// so opt out of the visual diff (`chromatic: { disableSnapshot: true }` on the
// `meta` below, which covers the whole group).

import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect, waitFor } from 'storybook/test'
import { type DiagramData, VIEW_MODES, type ZxDiagramElement } from '../../src/index'
import { fourSpiderSquare } from '../diagrams'
import { shadowRootOf } from '../interactionHelpers'

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

/** The three ways `<zx-diagram>` refuses to draw, in one story.
 *
 * They are together rather than one apiece because the error UI is the same
 * `<pre>` and Retry button in all three and the *message* is the whole of what
 * is being tested — three stories would be three views of the same grey box.
 */
export const ErrorStates: Story = {
  name: 'Error states',
  parameters: {
    docs: {
      story: {
        description:
          'Three failures, one under the other: a malformed diagram, a diagram carrying a node the dual has no shape for, and a `view-mode` that is not one of the four. Each is reported rather than drawn around — an unknown `view-mode` in particular has no mode to fall back *to* that would not be a guess at which was meant, so it says so instead of quietly drawing the graph.',
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
