import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect } from 'storybook/test'
import type { ColorSchemeName, DiagramData, DiagramEdge, DiagramNode } from '../src/zxRender'
import { shadowRootOf } from './interactionHelpers'

interface Args {
  leftColor: 'Z' | 'X'
  leftPhase: string
  rightColor: 'Z' | 'X'
  rightPhase: string
  hadamardOnEdge: boolean
  parallelEdges: number
  box: 'none' | 'stack' | 'compose'
  colorScheme: ColorSchemeName
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
  // color-scheme is bound as a real attribute, not a property, so this also
  // exercises the attribute path.
  render: args =>
    html`<zx-diagram
      .diagram=${buildDiagram(args)}
      color-scheme=${args.colorScheme}
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
    colorScheme: { control: 'inline-radio', options: ['original', 'rgb', 'grayscale'] },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Two spiders wired input → left → right → output. Use the controls to change colours, phases, insert a Hadamard, add parallel edges, or wrap the pair in a stack/compose box.',
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
  colorScheme: 'original',
}

export const Interactive: Story = {
  args: baseArgs,
}
