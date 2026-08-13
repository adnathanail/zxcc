import { beforeEach, expect, test, vi } from 'vitest'
import type { DiagramData } from '../zxRender'

// The custom-elements registry is global and can't be reset, so we mock the
// dependencies once (hoisted), toggle their behaviour per test, and import
// zxDiagram exactly once.
const control = vi.hoisted(() => ({ shouldThrow: false }))

vi.mock('../zxViewer.js', () => ({ default: 'function showGraph() {}' }))
vi.mock('d3', () => ({}))
vi.mock('../zxRender', async () => {
  const actual = await vi.importActual<typeof import('../zxRender')>('../zxRender')
  return {
    ...actual,
    render: (d: DiagramData) => {
      if (control.shouldThrow) throw new Error('TS render error')
      return actual.render(d)
    },
  }
})

import '../zxDiagram'

const diagram: DiagramData = {
  nodes: [
    { id: 0, type: 'input', ioId: 0 },
    { id: 1, type: 'spider', color: 'Z', phase: '1/2' },
    { id: 2, type: 'output', ioId: 0 },
  ],
  edges: [
    { src: 0, tgt: 1 },
    { src: 1, tgt: 2 },
  ],
}

async function mount(el: HTMLElement & { updateComplete: Promise<boolean> }) {
  document.body.appendChild(el)
  // Two microtask flushes: one for connectedCallback -> requestUpdate,
  // one for the child ref callback that mounts the D3 container.
  await el.updateComplete
  await Promise.resolve()
}

beforeEach(() => {
  control.shouldThrow = false
  document.body.innerHTML = ''
})

test('renders the D3 container after a successful render', async () => {
  const el = document.createElement('zx-diagram') as HTMLElement & {
    diagram: DiagramData
    updateComplete: Promise<boolean>
  }
  el.diagram = diagram
  await mount(el)
  const container = el.shadowRoot?.querySelector('.container')
  expect(container).not.toBeNull()
})

test('shows an error message when the render call throws', async () => {
  control.shouldThrow = true
  const el = document.createElement('zx-diagram') as HTMLElement & {
    diagram: DiagramData
    updateComplete: Promise<boolean>
  }
  el.diagram = diagram
  await mount(el)
  const pre = el.shadowRoot?.querySelector('.error pre')
  expect(pre?.textContent).toMatch(/TS render error/)
})
