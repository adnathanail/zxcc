// Geometry for the ZX diagram itself: the SVG path strings for edges, Pauli
// strands, boxes and the ground symbol, plus the H-box drag arithmetic.
//
// Nothing here touches the DOM. `<zx-viewer>` keeps only the *inputs* to these
// functions as state (dragged positions, H-box line parameters, selection) and
// derives every coordinate it paints by calling them.

import { curvePath, edgeCurve, type Point } from '../curves'
import type { SceneBox, SceneLink, SceneWeb } from '../types'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** How far a drag of (dx, dy) advances an H-box along its chain line, or
 *  null when the endpoints coincide and the line is degenerate. */
export function lineParamDelta(a: Point, b: Point, dx: number, dy: number): number | null {
  const ex = b.x - a.x
  const ey = b.y - a.y
  const lenSq = ex * ex + ey * ey
  if (lenSq <= 0.001) return null
  return (dx * ex + dy * ey) / lenSq
}

/** Straight for a lone edge, a fanned quadratic arc for parallel edges, and
 *  a loop above the node for self-edges — `edgeCurve` decides which, this
 *  draws it. */
export function linkPath(link: SceneLink, pos: Map<number, Point>): string {
  const s = pos.get(link.source)
  const t = pos.get(link.target)
  if (!s || !t) return ''
  return curvePath(edgeCurve(s, t, link.index, link.parallel))
}

/** A strand runs from its source to the midpoint of the edge it sits on. */
export function webPath(web: SceneWeb, pos: Map<number, Point>): string {
  const s = pos.get(web.source)
  const t = pos.get(web.target)
  if (!s || !t) return ''
  return `M ${s.x} ${s.y} L ${(s.x + t.x) / 2} ${(s.y + t.y) / 2}`
}

/** Bounding rect around a box's nodes, or null when none of them are on the
 *  diagram (its wires were spliced away). */
export function boxBounds(box: SceneBox, pos: Map<number, Point>, pad: number): Rect | null {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const id of box.nodeIds) {
    const p = pos.get(id)
    if (!p) continue
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  if (!Number.isFinite(minX)) return null
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + 2 * pad,
    height: maxY - minY + 2 * pad,
  }
}

/** The pyzx ground symbol: a vertical stem, then three horizontal strokes of
 *  decreasing width. `size` is the symbol's full extent, so the stem and the
 *  widest stroke each reach `size / 2` from the node's centre. */
export function groundSymbolPath(size: number): string {
  const s = size / 2
  const t = (s * 2) / 3
  const u = s / 3
  return (
    `M 0 ${-s} L 0 0 ` +
    `M ${-s} 0 L ${s} 0 ` +
    `M ${-t} ${u} L ${t} ${u} ` +
    `M ${-u} ${2 * u} L ${u} ${2 * u}`
  )
}
