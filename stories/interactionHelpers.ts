// Shared DOM helpers for the story play functions. The viewer mounts into
// <zx-diagram>'s shadow root, so every query has to go through it.

import { expect, waitFor } from 'storybook/test'
import { type DiagramData, toHypergraph, type ZxDiagramElement } from '../src/index'

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

/** Ids of the hyperedge blobs currently drawn as selected, in document order.
 *  The viewer marks a selection with the same blue stroke `<zx-viewer>` uses,
 *  set in the path's `style`. */
export function selectedBlobsIn(root: ShadowRoot): string[] {
  return [...root.querySelectorAll<SVGGElement>('svg g.blob g[data-hyperedge]')]
    .filter(g => (g.querySelector('path')?.getAttribute('style') ?? '').includes('#00f'))
    .map(g => g.getAttribute('data-hyperedge') ?? '')
}

/**
 * The wires whose dots fall inside a blob **as painted** — asked of the SVG
 * path itself rather than recomputed, so this checks the picture rather than
 * the geometry that produced it.
 */
export function paintedBlobMembers(root: ShadowRoot, blobId: string): string[] {
  const path = root.querySelector<SVGPathElement>(`g[data-hyperedge="${blobId}"] path`)
  if (!path) throw new Error(`blob ${blobId} not mounted`)
  return [...root.querySelectorAll<SVGGElement>('g[data-wire]')]
    .filter(dot => {
      const [x, y] = translateOf(dot)
      return path.isPointInFill(new DOMPoint(x, y))
    })
    .map(dot => dot.getAttribute('data-wire') ?? '')
}

/**
 * Assert the hypergraph view's central claim: every blob encloses its own dots
 * and no others. A blob that swallows a foreign dot is drawing a different
 * diagram — one where that wire is a leg of that spider.
 *
 * Convex outlines cannot promise this in general (a foreign dot between two
 * members is inside any convex shape holding both), which is exactly why it is
 * asserted on the diagrams that come closest to breaking it rather than
 * assumed.
 */
export function expectBlobMembership(root: ShadowRoot, diagram: DiagramData): void {
  for (const hyperedge of toHypergraph(diagram).hyperedges) {
    const own = [...new Set(hyperedge.wires)].sort()
    // The id rides along in the assertion so a failure names the blob.
    expect([hyperedge.id, paintedBlobMembers(root, hyperedge.id).sort()]).toEqual([
      hyperedge.id,
      own,
    ])
  }
}

/**
 * Assert that no blob's outline crowds a dot it holds: the boundary stays at
 * least `dotRadii` times a dot's drawn radius away from each of its own.
 *
 * The companion to {@link expectBlobMembership}, and a different kind of
 * claim: membership says the right dots are inside, this says they are inside
 * with room to spare. Smoothing the outline once broke exactly this — it pulled
 * the boundary to within a pixel of a dot's edge while leaving membership
 * perfectly correct — so it is measured off the painted path too.
 */
export function expectBlobBreathingRoom(root: ShadowRoot, dotRadii = 2): void {
  const dots = [...root.querySelectorAll<SVGGElement>('g[data-wire]')].map(g => ({
    id: g.getAttribute('data-wire') ?? '',
    at: translateOf(g),
    radius: Number(g.querySelector('circle')?.getAttribute('r') ?? 0),
  }))

  for (const blob of root.querySelectorAll<SVGGElement>('g[data-hyperedge]')) {
    const path = blob.querySelector('path')
    if (!path) throw new Error(`blob ${blob.getAttribute('data-hyperedge')} has no outline`)
    const length = path.getTotalLength()
    const outline = Array.from({ length: 400 }, (_, i) => path.getPointAtLength((length * i) / 400))

    for (const dot of dots) {
      const [x, y] = dot.at
      if (!path.isPointInFill(new DOMPoint(x, y))) continue
      const gap = Math.min(...outline.map(p => Math.hypot(p.x - x, p.y - y)))
      const where = `${blob.getAttribute('data-hyperedge')} holds ${dot.id}`
      expect([where, gap > dotRadii * dot.radius]).toEqual([where, true])
    }
  }
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
