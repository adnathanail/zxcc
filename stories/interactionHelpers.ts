// Shared DOM helpers for the story play functions. The viewer mounts into
// <zx-diagram>'s shadow root, so every query has to go through it.

import { waitFor } from 'storybook/test'
import type { ZxDiagramElement } from '../src/index'

export function parseTranslate(transform: string): [number, number] {
  const m = transform.match(/translate\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/)
  if (!m) throw new Error(`transform did not match translate(x,y): ${transform}`)
  return [Number.parseFloat(m[1]), Number.parseFloat(m[2])]
}

export function translateOf(g: SVGGElement): [number, number] {
  return parseTranslate(g.getAttribute('transform') ?? '')
}

/** The shadow root of the story's `<zx-diagram>`. Pass a selector when a story
 *  renders more than one of them — combining several cases into one story is
 *  how the error stories avoid a Chromatic snapshot each. */
export async function shadowRootOf(
  canvasElement: HTMLElement,
  selector = 'zx-diagram',
): Promise<ShadowRoot> {
  await customElements.whenDefined('zx-diagram')
  const el = canvasElement.querySelector<ZxDiagramElement>(selector)
  if (!el) throw new Error(`${selector} not found`)
  if (!el.shadowRoot) throw new Error(`${selector} has no shadow root`)
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

/** All node <g>s carrying `shape[fill]`, in document (i.e. node-id) order. */
export async function waitForNodes(
  root: ShadowRoot,
  shape: 'circle' | 'rect',
  fill: string,
  count: number,
): Promise<SVGGElement[]> {
  return waitFor(() => {
    const gs = [...root.querySelectorAll<SVGGElement>(`svg g.node g:has(${shape}[fill="${fill}"])`)]
    if (gs.length < count) {
      throw new Error(`expected ${count} ${shape}[fill=${fill}] nodes, saw ${gs.length}`)
    }
    return gs
  })
}

/** The `d` of every path in a layer group, in document order. */
export function pathDataIn(root: ShadowRoot, layer: 'link' | 'web'): string[] {
  return [...root.querySelectorAll<SVGPathElement>(`svg g.${layer} path`)].map(
    p => p.getAttribute('d') ?? '',
  )
}

/** The `stroke` of every path in a layer group, in document order. */
export function strokesIn(root: ShadowRoot, layer: 'link' | 'web'): string[] {
  return [...root.querySelectorAll<SVGPathElement>(`svg g.${layer} path`)].map(
    p => p.getAttribute('stroke') ?? '',
  )
}

/** Ids of the hyperedge blobs currently drawn as picked out, in document order.
 *  The viewer marks one with the same blue stroke `<zx-viewer>` uses, set in
 *  the path's `style`. Pass `'named'` for the ones the selection names outright
 *  (drawn solid) or `'implied'` for the ones derived from it (drawn dashed);
 *  with no argument, both. */
export function selectedBlobsIn(root: ShadowRoot, pick?: 'named' | 'implied'): string[] {
  return [...root.querySelectorAll<SVGGElement>('svg g.blob g[data-hyperedge]')]
    .filter(g => {
      const path = g.querySelector('path')
      if (!(path?.getAttribute('style') ?? '').includes('#00f')) return false
      const implied = path?.classList.contains('implied') ?? false
      return pick === undefined || (pick === 'implied') === implied
    })
    .map(g => g.getAttribute('data-hyperedge') ?? '')
}

/** Ids of the hyperedge blobs drawn, in document order — every blob, picked out
 *  or not. Paint order is depth order, so this is not node-id order. */
export function blobIdsIn(root: ParentNode): string[] {
  return [...root.querySelectorAll('svg g.blob g[data-hyperedge]')].map(
    g => g.getAttribute('data-hyperedge') ?? '',
  )
}

/** Ids of the wires drawn as dots, in document order. */
export function dotIdsIn(root: ParentNode): string[] {
  return [...root.querySelectorAll('svg g.dot g[data-wire]')].map(
    g => g.getAttribute('data-wire') ?? '',
  )
}

/** Ids of the nodes drawn as selected in the diagram view, in document order.
 *  `<zx-viewer>` marks one with the same blue stroke the hypergraph view uses,
 *  set in the shape's `style`. Scoped to the painter, since in `both` mode the
 *  two views are in one tree. */
export function selectedNodesIn(root: ShadowRoot): number[] {
  return [...root.querySelectorAll<SVGGElement>('zx-viewer g.node g[data-node]')]
    .filter(g =>
      [...g.querySelectorAll('circle, rect, path')].some(shape =>
        (shape.getAttribute('style') ?? '').includes('#00f'),
      ),
    )
    .map(g => Number(g.getAttribute('data-node')))
}

/** Indices of the edges drawn as selected in the diagram view. A selected edge
 *  keeps its own colour and is cased in blue instead, so the marker is a path
 *  in `g.casing` rather than anything about the wire — it carries `data-link`,
 *  the edge's index in `diagram.edges`. */
export function selectedLinksIn(root: ShadowRoot): number[] {
  return [...root.querySelectorAll<SVGPathElement>('zx-viewer g.casing path[data-link]')].map(
    path => Number(path.getAttribute('data-link')),
  )
}

/** Ids of the wires whose dots are ringed, in document order. `'named'` is the
 *  dot the selection names — the one pressed, ringed solid — and `'implied'`
 *  the ones that follow from it, ringed dashed; with no argument, both. */
export function ringedDotsIn(root: ShadowRoot, pick?: 'named' | 'implied'): string[] {
  const selector =
    pick === undefined
      ? 'circle.selected'
      : pick === 'implied'
        ? 'circle.selected.implied'
        : 'circle.selected:not(.implied)'
  return [...root.querySelectorAll<SVGGElement>('svg g.dot g[data-wire]')]
    .filter(g => g.querySelector(selector))
    .map(g => g.getAttribute('data-wire') ?? '')
}

/** Each blob's caption, split into its `<tspan>` pieces — `Z(`, the phase, `)`
 *  — so an assertion can tell the grey name from the blue phase. */
export function blobCaptionsIn(root: ParentNode): (string | null)[][] {
  return [...root.querySelectorAll('svg g.blob text')].map(t =>
    [...t.querySelectorAll('tspan')].map(s => s.textContent),
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

// Drag a single already-selected node. mousedown lands on the node, but the
// viewer tracks the rest of the gesture on window (`#track`), so the move and
// up events have to be dispatched there rather than at the node.
export function performDrag(node: SVGGElement, dx: number, dy: number): void {
  const startX = 100
  const startY = 100
  fireMouse('mousedown', node, startX, startY)
  fireMouse('mousemove', window, startX + dx, startY + dy)
  fireMouse('mouseup', window, startX + dx, startY + dy)
}
