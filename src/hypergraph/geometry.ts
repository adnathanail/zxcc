// Geometry for the hypergraph view: where a wire's dot sits, and the outline
// that encloses the dots of one hyperedge.
//
// DOM-free, and the counterpart of `src/geometry.ts`, which stays the geometry
// of the ZX diagram itself. The two share `src/curves.ts` and nothing else:
// `wireDot` reads the very curve the ZX viewer paints a wire as, rather than a
// second opinion about where that wire runs.

import { curvePointAt, edgeCurve, type Point } from '../curves'
import type { SceneLink } from '../types'
import type { HypergraphBlob } from './types'

/** Where the dot for a wire goes: halfway along the curve the ZX viewer draws
 *  the same edge as. That is why parallel edges get distinct dots — they are
 *  drawn as a fan of arcs — and why a self-loop's dot sits inside its loop.
 *  Null when either endpoint is off the diagram. */
export function wireDot(link: SceneLink, pos: Map<number, Point>): Point | null {
  const s = pos.get(link.source)
  const t = pos.get(link.target)
  if (!s || !t) return null
  return curvePointAt(edgeCurve(s, t, link.index, link.parallel), 0.5)
}

/** Convex hull, counter-clockwise in maths axes (so clockwise on screen, where
 *  y grows downwards). Duplicate and collinear points are dropped, so the hull
 *  of two or more coincident points is a single point and the hull of a
 *  collinear run is its two ends. */
export function convexHull(points: Point[]): Point[] {
  const unique = [...new Map(points.map(p => [`${p.x},${p.y}`, p])).values()]
  unique.sort((a, b) => a.x - b.x || a.y - b.y)
  if (unique.length <= 2) return unique

  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const halfHull = (seq: Point[]) => {
    const out: Point[] = []
    for (const p of seq) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop()
      out.push(p)
    }
    out.pop()
    return out
  }
  return [...halfHull(unique), ...halfHull([...unique].reverse())]
}

/** Shoelace, in screen axes. Positive means the polygon runs clockwise as
 *  drawn, which is the orientation {@link blobPath} offsets outwards from. */
function signedArea(polygon: Point[]): number {
  let sum = 0
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i]
    const q = polygon[(i + 1) % polygon.length]
    sum += p.x * q.y - q.x * p.y
  }
  return sum
}

/**
 * A closed outline enclosing every point, standing `radius` off the convex
 * hull of them: straight along each hull edge, a circular arc round each hull
 * vertex. One point gives a circle, two give a capsule, more give a rounded
 * convex polygon — so a hyperedge stays legible at any arity.
 */
export function blobPath(points: Point[], radius: number): string {
  const hull = convexHull(points)
  if (hull.length === 0) return ''
  if (hull.length === 1) {
    const { x, y } = hull[0]
    return (
      `M ${x - radius} ${y} A ${radius} ${radius} 0 1 1 ${x + radius} ${y} ` +
      `A ${radius} ${radius} 0 1 1 ${x - radius} ${y} Z`
    )
  }
  // Two-point hulls are degenerate (zero area) and symmetric, so either
  // orientation gives the same capsule.
  if (signedArea(hull) < 0) hull.reverse()

  // Offset each edge along its outward normal; consecutive offset edges are
  // then joined by an arc centred on the hull vertex between them.
  const edges = hull.map((p, i) => {
    const q = hull[(i + 1) % hull.length]
    const dx = q.x - p.x
    const dy = q.y - p.y
    const len = Math.hypot(dx, dy) || 1
    const nx = (dy / len) * radius
    const ny = (-dx / len) * radius
    return { from: { x: p.x + nx, y: p.y + ny }, to: { x: q.x + nx, y: q.y + ny } }
  })

  let d = `M ${edges[0].from.x} ${edges[0].from.y}`
  for (let i = 0; i < edges.length; i++) {
    const next = edges[(i + 1) % edges.length]
    d += ` L ${edges[i].to.x} ${edges[i].to.y}`
    d += ` A ${radius} ${radius} 0 0 1 ${next.from.x} ${next.from.y}`
  }
  return `${d} Z`
}

function dotPoints(blob: HypergraphBlob, pos: Map<string, Point>): Point[] {
  const points: Point[] = []
  for (const id of blob.dots) {
    const p = pos.get(id)
    if (p) points.push(p)
  }
  return points
}

/** The outline for one blob, from the live dot positions. Derived per render
 *  rather than stored, the way `<zx-viewer>` derives its box bounds. */
export function blobOutline(blob: HypergraphBlob, pos: Map<string, Point>, radius: number): string {
  return blobPath(dotPoints(blob, pos), radius)
}

/** Baseline for a blob's label: centred over the blob, just clear of the top
 *  of its outline. */
export function blobLabelAnchor(
  blob: HypergraphBlob,
  pos: Map<string, Point>,
  radius: number,
): Point | null {
  const points = dotPoints(blob, pos)
  if (points.length === 0) return null
  const x = points.reduce((sum, p) => sum + p.x, 0) / points.length
  const top = Math.min(...points.map(p => p.y))
  return { x, y: top - radius - 5 }
}
