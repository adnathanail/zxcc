import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { ifDefined } from 'lit/directives/if-defined.js'
import { expect } from 'storybook/test'
import type { ColorSchemeName, DiagramData, DiagramEdge, DiagramNode } from '../src/index'
import { shadowRootOf } from './interactionHelpers'

interface Args {
  leftColor: 'Z' | 'X'
  leftPhase: string
  rightColor: 'Z' | 'X'
  rightPhase: string
  hadamardOnEdge: boolean
  parallelEdges: number
  box: 'none' | 'stack' | 'compose'
  viewAsHypergraph: boolean
  showLabels: boolean
  colorScheme: ColorSchemeName
  /** Left unset so the element derives it; the range control overrides. */
  scale?: number
}

function buildDiagram(args: Args): DiagramData {
  const nodes: DiagramNode[] = [
    { id: 0, type: 'input', ioId: 0 },
    { id: 1, type: 'spider', color: args.leftColor, phase: args.leftPhase },
    { id: 2, type: 'spider', color: args.rightColor, phase: args.rightPhase },
    { id: 3, type: 'output', ioId: 0 },
  ]
  const edges: DiagramEdge[] = [{ src: 0, tgt: 1 }]

  if (args.hadamardOnEdge) {
    nodes.push({ id: 4, type: 'hadamard' })
    edges.push({ src: 1, tgt: 4 })
    for (let i = 0; i < args.parallelEdges; i++) edges.push({ src: 4, tgt: 2 })
  } else {
    for (let i = 0; i < args.parallelEdges; i++) edges.push({ src: 1, tgt: 2 })
  }
  edges.push({ src: 2, tgt: 3 })

  const diagram: DiagramData = { nodes, edges }
  if (args.box !== 'none') {
    diagram.boxes = [{ kind: args.box, nodeIds: [1, 2] }]
  }
  return diagram
}

const meta: Meta<Args> = {
  title: 'Playground',
  // show-labels, color-scheme and scale are bound as real attributes, not
  // properties, so this also exercises the attribute converters. scale is
  // omitted entirely when unset, so the element keeps deriving it.
  render: args =>
    html`<zx-diagram
      .diagram=${buildDiagram(args)}
      ?view-as-hypergraph=${args.viewAsHypergraph}
      show-labels=${args.showLabels ? '' : 'false'}
      color-scheme=${args.colorScheme}
      scale=${ifDefined(args.scale)}
      style="min-height: 160px"
    ></zx-diagram>`,
  argTypes: {
    leftColor: { control: 'inline-radio', options: ['Z', 'X'] },
    leftPhase: { control: 'text' },
    rightColor: { control: 'inline-radio', options: ['Z', 'X'] },
    rightPhase: { control: 'text' },
    hadamardOnEdge: { control: 'boolean' },
    parallelEdges: { control: { type: 'range', min: 1, max: 4, step: 1 } },
    box: { control: 'inline-radio', options: ['none', 'stack', 'compose'] },
    viewAsHypergraph: { control: 'boolean' },
    showLabels: { control: 'boolean' },
    colorScheme: { control: 'inline-radio', options: ['original', 'rgb', 'grayscale'] },
    scale: { control: { type: 'range', min: 10, max: 100, step: 5 } },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Two spiders wired input → left → right → output. Use the controls to change colours, phases, insert a Hadamard, add parallel edges, wrap the pair in a stack/compose box, switch to the hypergraph dual, toggle node-id labels, switch pyzx colour scheme, or pin the pixels-per-row scale.',
      },
    },
  },
}

export default meta

type Story = StoryObj<Args>

const baseArgs: Args = {
  leftColor: 'Z',
  leftPhase: 'π/2',
  rightColor: 'X',
  rightPhase: '0',
  hadamardOnEdge: false,
  parallelEdges: 1,
  box: 'none',
  viewAsHypergraph: false,
  showLabels: true,
  colorScheme: 'original',
}

export const Interactive: Story = {
  args: baseArgs,
  play: async ({ canvasElement }) => {
    const root = await shadowRootOf(canvasElement)
    // Node-id labels are the grey texts above each node.
    const labels = root.querySelectorAll('svg g.node text[fill="#999"]')
    expect(labels.length).toBeGreaterThan(0)
  },
}
