// Stories that exist for their play function rather than for their picture, and
// so opt out of the visual diff (`chromatic: { disableSnapshot: true }` on the
// `meta` below, which covers the whole group).

import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect, waitFor } from 'storybook/test'
import { type DiagramData, VIEW_MODES } from '../../src/index'
import { fourSpiderSquare } from '../diagrams'
import { shadowRootOf } from '../interactionHelpers'

const meta: Meta = {
  title: 'Other/Tests',
  parameters: {
    chromatic: { disableSnapshot: true },
    docs: {
      description: {
        component:
          'Assertions rather than pictures. Nothing here is snapshotted: the error UI is the same grey box whatever caused it, and what is being tested is the message.',
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
      "Hypergraph view: node 2 is a 'z-box', only 'spider' and 'hadamard' nodes " +
        "can be drawn as hyperedges. ('input' and 'output' are fine: they are " +
        'wires, not hyperedges.)',
    )

    // 3. `both` is the plausible typo — there are two `both` modes and neither
    // is called that. The message names the value it was given and lists every
    // mode there is, built from the same array the check reads.
    expect(await messageOf('bad-mode')).toBe(
      `Unknown view-mode 'both'. Expected one of: ${VIEW_MODES.join(', ')}.`,
    )
  },
}
