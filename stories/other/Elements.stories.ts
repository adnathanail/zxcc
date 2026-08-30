// The element layer: which of the three you reach for, and what `<zx-diagram>`
// does that the other two don't.

import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect, waitFor } from 'storybook/test'
import { type DiagramData, RGB_COLORS, type Selection } from '../../src/index'
import { fourSpiderSquare } from '../diagrams'
import { firePointer, shadowRootOf } from '../interactionHelpers'

interface Args {
  diagram: DiagramData
}

const meta: Meta<Args> = {
  title: 'Other/Elements',
  args: { diagram: fourSpiderSquare },
  parameters: {
    docs: {
      description: {
        component:
          'There are three public elements. `<zx-graph>` draws a ZX diagram, `<zx-hypergraph>` draws a hypergraph, and `<zx-diagram>` takes a diagram and mounts one or both of the others — deriving the hypergraph from the diagram is the thing it does that neither of them can. Reach for `<zx-graph>` when the picture you want is the diagram and nothing else; reach for `<zx-diagram>` when you want the dual, or the pair.',
      },
    },
  },
}

export default meta

type Story = StoryObj<Args>

export const GraphAlone: Story = {
  name: '1. <zx-graph> on its own',
  parameters: {
    docs: {
      story: {
        description:
          'The diagram drawn by `<zx-graph>`, which takes a `DiagramData` and a `scale` and has no `view-mode`: it draws the one picture. It carries the same presentation properties as `<zx-diagram>` and reports a gesture the same way — a press announces `zx-selection` on the element itself, which is how `<zx-diagram>` hears about presses in a view it mounted, and equally how your own code can.',
      },
    },
  },
  render: ({ diagram }) =>
    html`<zx-graph .diagram=${diagram} show-labels style="min-height: 160px"></zx-graph>`,
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement, 'zx-graph')
    const el = canvasElement.querySelector('zx-graph')
    if (!el) throw new Error('zx-graph not found')

    await waitFor(() => expect(root.querySelectorAll('zx-viewer svg').length).toBe(1))
    // Its own picture, its own badge: `<zx-graph>` is a whole element rather
    // than a painter that needs a host around it.
    expect(root.querySelectorAll('g.attribution').length).toBe(1)

    // A press is announced by the element, not just by the painter inside it.
    const announced: Selection[] = []
    el.addEventListener('zx-selection', e => announced.push((e as CustomEvent<Selection>).detail))

    const node = root.querySelector<SVGGElement>('g.node g[data-node="1"]')
    if (!node) throw new Error('node 1 not mounted')
    const box = node.getBoundingClientRect()
    firePointer('pointerdown', node, box.left + box.width / 2, box.top + box.height / 2)
    firePointer('pointerup', window, box.left + box.width / 2, box.top + box.height / 2)

    await waitFor(() => expect(announced.length).toBeGreaterThan(0))
    expect([...announced[announced.length - 1].nodes]).toEqual([1])
  },
}

export const DiagramComposes: Story = {
  name: '2. <zx-diagram> mounts the other two',
  parameters: {
    docs: {
      story: {
        description:
          '`view-mode="both-vertical"` mounts a `<zx-graph>` and a `<zx-hypergraph>`, the same two elements you could have written yourself — what `<zx-diagram>` adds is the derivation that turns the diagram into the hypergraph input, the scale that makes the pair come out one size, and the selection they share. Presentation properties are passed down, so a palette set once here reaches both pictures: `color-scheme="rgb"` paints the Z spiders green in the diagram and their blobs the same green in the dual.',
      },
    },
  },
  render: ({ diagram }) =>
    html`<zx-diagram
      .diagram=${diagram}
      view-mode="both-vertical"
      color-scheme="rgb"
      style="min-height: 160px"
    ></zx-diagram>`,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('zx-diagram')
    if (!el?.shadowRoot) throw new Error('zx-diagram not found')
    await el.updateComplete

    // The pair is two public elements, one per view, rather than two painters
    // mounted directly — which is what makes each of them usable on its own.
    expect(el.shadowRoot.querySelectorAll('zx-graph').length).toBe(1)
    expect(el.shadowRoot.querySelectorAll('zx-hypergraph').length).toBe(1)

    const root = await shadowRootOf(canvasElement)
    await waitFor(() => expect(root.querySelectorAll('zx-viewer svg').length).toBe(1))
    expect(root.querySelectorAll('zx-hypergraph-viewer svg').length).toBe(1)

    // The palette reaches both, having been resolved once by the element the
    // scheme was set on: a spider and the blob standing for it are one colour.
    const spiders = [...root.querySelectorAll<SVGCircleElement>('zx-viewer g.node circle')]
      .map(c => c.getAttribute('fill'))
      .filter(fill => fill === RGB_COLORS.Z)
    expect(spiders.length).toBeGreaterThan(0)
    const blobs = [...root.querySelectorAll<SVGPathElement>('zx-hypergraph-viewer g.blob path')]
      .map(p => p.getAttribute('fill'))
      .filter(fill => fill === RGB_COLORS.Z)
    expect(blobs.length).toBe(spiders.length)
  },
}
