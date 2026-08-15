// Shared DOM helpers for the story play functions. The viewer mounts into
// <zx-diagram>'s shadow root, so every query has to go through it.

import { waitFor } from 'storybook/test'
import type { ZxDiagramElement } from '../src/zxDiagram'

export function parseTranslate(transform: string): [number, number] {
  const m = transform.match(/translate\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/)
  if (!m) throw new Error(`transform did not match translate(x,y): ${transform}`)
  return [Number.parseFloat(m[1]), Number.parseFloat(m[2])]
}

export function translateOf(g: SVGGElement): [number, number] {
  return parseTranslate(g.getAttribute('transform') ?? '')
}

export async function shadowRootOf(canvasElement: HTMLElement): Promise<ShadowRoot> {
  await customElements.whenDefined('zx-diagram')
  const el = canvasElement.querySelector<ZxDiagramElement>('zx-diagram')
  if (!el) throw new Error('zx-diagram not found')
  if (!el.shadowRoot) throw new Error('zx-diagram has no shadow root')
  return el.shadowRoot
}

export async function waitForNode(
  root: ShadowRoot,
  shape: 'circle' | 'rect',
  fill: string,
): Promise<SVGGElement> {
  return waitFor(() => {
    const g = root.querySelector<SVGGElement>(`svg g.node g:has(${shape}[fill="${fill}"])`)
    if (!g) throw new Error(`node <g> with ${shape}[fill=${fill}] not mounted`)
    return g
  })
}

/** The `stroke` of every path in a layer group, in document order. */
export function strokesIn(root: ShadowRoot, layer: 'link' | 'web'): string[] {
  return [...root.querySelectorAll<SVGPathElement>(`svg g.${layer} path`)].map(
    p => p.getAttribute('stroke') ?? '',
  )
}

/** The `fill` of every circular or rectangular node shape — spiders,
 *  boundaries and W-inputs (circles), H-boxes and Z-boxes (rects). Pass a
 *  shape to narrow to one of the two. */
export function nodeFillsIn(root: ShadowRoot, shape?: 'circle' | 'rect'): string[] {
  const selector = shape ? `svg g.node ${shape}` : 'svg g.node circle, svg g.node rect'
  return [...root.querySelectorAll<SVGElement>(selector)].map(el => el.getAttribute('fill') ?? '')
}

export function fireMouse(
  type: 'mousedown' | 'mousemove' | 'mouseup',
  target: EventTarget,
  clientX: number,
  clientY: number,
  shiftKey = false,
): void {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      clientX,
      clientY,
      shiftKey,
    }),
  )
}

export function fireKey(type: 'keydown' | 'keyup', target: EventTarget, shiftKey: boolean): void {
  target.dispatchEvent(
    new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      key: 'Shift',
      shiftKey,
    }),
  )
}

// Drag a single already-selected node. mousedown on the node then
// mousemove/mouseup on window matches d3-drag v1's listener topology.
export function performDrag(node: SVGGElement, dx: number, dy: number): void {
  const startX = 100
  const startY = 100
  fireMouse('mousedown', node, startX, startY)
  fireMouse('mousemove', window, startX + dx, startY + dy)
  fireMouse('mouseup', window, startX + dx, startY + dy)
}
