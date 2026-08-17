// Geometry for the hypergraph view: where a wire's dot sits, and the outline
// that encloses the dots of one hyperedge.
//
// DOM-free, and the counterpart of `src/geometry.ts`, which stays the geometry
// of the ZX diagram itself. The two share `src/curves.ts` and nothing else:
// `wireCurve` hands back the very curve the ZX viewer paints a wire as, rather
// than a second opinion about where that wire runs.
//
// A blob is asked several questions per render — draw your outline, does this
// point fall in you, does this dot's circle meet you — and all of them are
// answered from its convex hull. So the hull is computed once by `blobHull` and
// handed to the functions that need it, rather than each deriving its own. What
// a function takes says which it depends on: `hull*` takes the hull, `blob*`
// takes the blob and the dot positions.

import { type Curve, edgeCurve, type Point } from '../curves'
import type { SceneLink } from '../types'
import type { HypergraphBlob } from './types'

/** The curve a wire's dot rides: the one the ZX viewer draws the same edge as.
 *  Null when either endpoint is off the diagram.
 *
 *  The curve rather than a point, because where on it the dot goes is not
 *  fixed. Halfway along is the default — which is why parallel edges get
 *  distinct dots, they are drawn as a fan of arcs, and why a self-loop's dot
 *  sits inside its loop — but two crossing edges share that point, and one dot
 *  where there should be two is a different diagram, so the layout slides such
 *  a dot along this same curve until they read as two. Handing back the curve
 *  is what keeps that slide on the wire the viewer actually paints. */
export function wireCurve(link: SceneLink, pos: Map<number, Point>): Curve | null {
  const s = pos.get(link.source)
  const t = pos.get(link.target)
  if (!s || !t) return null
  return edgeCurve(s, t, link.index, link.parallel)
}

/** Convex hull, counter-clockwise in maths axes (so clockwise on screen, where
 *  y grows downwards). Duplicate and collinear points are dropped, so the hull
 *  of two or more coincident points is a single point and the hull of a
 *  collinear run is its two ends. */
function convexHull(points: Point[]): Point[] {
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

/** The hull wound so it runs clockwise as drawn, which is the direction
 *  {@link hullPath} offsets outwards from and {@link hullContains} tests
 *  against. A two-point hull has zero area and is symmetric, so its winding is
 *  moot. */
function orientedHull(points: Point[]): Point[] {
  const hull = convexHull(points)
  if (signedArea(hull) < 0) hull.reverse()
  return hull
}

/**
 * The hull of one blob's dots, from the live dot positions.
 *
 * This is the expensive step — a sort and a monotone chain — and the shape
 * every other question about a blob is answered from, so a caller drawing a
 * whole scene computes it once per blob and passes it to the functions below
 * rather than letting each of them derive it again.
 */
export function blobHull(blob: HypergraphBlob, pos: Map<string, Point>): Point[] {
  return orientedHull(dotPoints(blob, pos))
}

/**
 * A closed outline standing `radius` off the hull: straight along each hull
 * edge, a circular arc round each hull vertex. One point gives a circle, two
 * give a capsule, more give a rounded convex polygon — so a hyperedge stays
 * legible at any arity, and a boundary's single dot comes out a circle.
 */
export function hullPath(hull: Point[], radius: number): string {
  if (hull.length === 0) return ''
  if (hull.length === 1) {
    const { x, y } = hull[0]
    return (
      `M ${x - radius} ${y} A ${radius} ${radius} 0 1 1 ${x + radius} ${y} ` +
      `A ${radius} ${radius} 0 1 1 ${x - radius} ${y} Z`
    )
  }
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

/** Mean of the points — inside the hull of them, and so inside the outline
 *  `blobPath` draws around it. */
function centroid(points: Point[]): Point {
  const x = points.reduce((sum, p) => sum + p.x, 0) / points.length
  const y = points.reduce((sum, p) => sum + p.y, 0) / points.length
  return { x, y }
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
  const top = Math.min(...points.map(p => p.y))
  return { x: centroid(points).x, y: top - radius - 5 }
}

/** The middle of a blob — the point a leader line from its caption is aimed
 *  at. Inside the outline by construction, and far enough from the caption to
 *  be worth drawing a line to: the caption is parked a few pixels off the top
 *  of the outline, so a line to the boundary would be too short to see. */
export function blobCentre(blob: HypergraphBlob, pos: Map<string, Point>): Point | null {
  const points = dotPoints(blob, pos)
  return points.length === 0 ? null : centroid(points)
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  // A zero-length segment is the one-point hull: the distance to the point.
  const t = lengthSq === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq
  const clamped = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + clamped * dx), p.y - (a.y + clamped * dy))
}

/**
 * Whether `point` falls inside the outline {@link hullPath} draws — that is,
 * within `radius` of the hull.
 *
 * Tested against the geometry rather than by asking the DOM what was clicked,
 * because blobs overlap: SVG hit-testing reports only the topmost path, and
 * which one that is says nothing about the others under the pointer.
 *
 * `radius` is a parameter rather than the blob's own standoff because the same
 * hull is asked two questions: whether a press landed inside the outline, and
 * whether a dot's circle meets it, which is the same test with the radius
 * fattened by the dot.
 */
export function hullContains(hull: Point[], radius: number, point: Point): boolean {
  if (hull.length === 0) return false

  // Inside the hull itself, every edge has the point on its right — the hull
  // is convex and wound clockwise. Degenerate hulls (a point, a segment) have
  // no interior, so they fall through to the distance test.
  if (hull.length >= 3) {
    let inside = true
    for (let i = 0; i < hull.length && inside; i++) {
      const a = hull[i]
      const b = hull[(i + 1) % hull.length]
      inside = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x) >= 0
    }
    if (inside) return true
  }

  for (let i = 0; i < hull.length; i++) {
    if (distanceToSegment(point, hull[i], hull[(i + 1) % hull.length]) <= radius) return true
  }
  return false
}
