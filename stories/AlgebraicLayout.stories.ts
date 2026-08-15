import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import type { DiagramData } from '../src/index'

interface Args {
  diagram: DiagramData
}

const meta: Meta<Args> = {
  title: 'Algebraic layout',
  render: ({ diagram }) =>
    html`<zx-diagram .diagram=${diagram} style="min-height: 120px"></zx-diagram>`,
  parameters: {
    docs: {
      description: {
        component:
          'Setting `col`/`qubit` on any node skips BFS auto-layout. `boxes` draws translucent rectangles behind subtrees: orange dashed for `stack`, blue solid for `compose`. Boxes are sorted largest-first so outer paints behind inner.',
      },
    },
  },
}

export default meta

type Story = StoryObj<Args>

export const SpiderZ22: Story = {
  name: '8. spider Z 2 2 (π/2)',
  args: {
    diagram: {
      nodes: [
        { id: 0, type: 'spider', color: 'Z', phase: 'π/2', col: 0, qubit: 0.5 },
        { id: 1, type: 'input', ioId: 0, col: -1, qubit: 0 },
        { id: 2, type: 'input', ioId: 1, col: -1, qubit: 1 },
        { id: 3, type: 'output', ioId: 0, col: 1, qubit: 0 },
        { id: 4, type: 'output', ioId: 1, col: 1, qubit: 1 },
      ],
      edges: [
        { src: 1, tgt: 0 },
        { src: 2, tgt: 0 },
        { src: 0, tgt: 3 },
        { src: 0, tgt: 4 },
      ],
    },
  },
}

export const StackZX: Story = {
  name: '9. stack (Z 1 1 α) (X 1 1 β)',
  args: {
    diagram: {
      nodes: [
        { id: 0, type: 'spider', color: 'Z', phase: '0', col: 0, qubit: 0 },
        { id: 1, type: 'spider', color: 'X', phase: 'π', col: 0, qubit: 1 },
        { id: 2, type: 'input', ioId: 0, col: -1, qubit: 0 },
        { id: 3, type: 'input', ioId: 1, col: -1, qubit: 1 },
        { id: 4, type: 'output', ioId: 0, col: 1, qubit: 0 },
        { id: 5, type: 'output', ioId: 1, col: 1, qubit: 1 },
      ],
      edges: [
        { src: 2, tgt: 0 },
        { src: 0, tgt: 4 },
        { src: 3, tgt: 1 },
        { src: 1, tgt: 5 },
      ],
      labels: [
        [0, 'α'],
        [1, 'β'],
      ],
      boxes: [{ kind: 'stack', nodeIds: [0, 1] }],
    },
  },
}

export const ComposeZZ: Story = {
  name: '10. compose (Z 1 2 0) (Z 2 1 0)',
  args: {
    diagram: {
      nodes: [
        { id: 0, type: 'spider', color: 'Z', phase: '0', col: 0, qubit: 0.5 },
        { id: 1, type: 'spider', color: 'Z', phase: '0', col: 1, qubit: 0.5 },
        { id: 2, type: 'input', ioId: 0, col: -1, qubit: 0.5 },
        { id: 3, type: 'output', ioId: 0, col: 2, qubit: 0.5 },
      ],
      edges: [
        { src: 2, tgt: 0 },
        { src: 0, tgt: 1 },
        { src: 0, tgt: 1 },
        { src: 1, tgt: 3 },
      ],
      boxes: [{ kind: 'compose', nodeIds: [0, 1] }],
    },
  },
}

export const NestedComposeStack: Story = {
  name: '11. Nested compose(stack(Z,Z), X)',
  args: {
    diagram: {
      nodes: [
        { id: 0, type: 'spider', color: 'Z', phase: '0', col: 0, qubit: 0 },
        { id: 1, type: 'spider', color: 'Z', phase: '0', col: 0, qubit: 1 },
        { id: 2, type: 'spider', color: 'X', phase: 'π/2', col: 1, qubit: 0.5 },
        { id: 3, type: 'input', ioId: 0, col: -1, qubit: 0 },
        { id: 4, type: 'input', ioId: 1, col: -1, qubit: 1 },
        { id: 5, type: 'output', ioId: 0, col: 2, qubit: 0.5 },
      ],
      edges: [
        { src: 3, tgt: 0 },
        { src: 4, tgt: 1 },
        { src: 0, tgt: 2 },
        { src: 1, tgt: 2 },
        { src: 2, tgt: 5 },
      ],
      boxes: [
        { kind: 'compose', nodeIds: [0, 1, 2] },
        { kind: 'stack', nodeIds: [0, 1] },
      ],
    },
  },
}
