// Geometry for the hypergraph view: where a wire's dot sits, and the outline
// of the blob standing for one ZX node.
//
// DOM-free, and the counterpart of `src/geometry.ts`, which stays the geometry
// of the ZX diagram itself. The two share `src/curves.ts` and nothing else:
// `wireDot` reads the very curve the ZX viewer paints a wire as, rather than a
// second opinion about where that wire runs.
//
// —— The blob outline ——
//
// A blob wants to be the rounded convex hull of its dots: that is the shape
// that reads as "these dots belong together". But a hull spans everything
// between its dots, so a dot belonging to *another* spider that happens to lie
// between two of this one's legs ends up inside it, and the picture then says
// that wire is a leg of this spider. In the 2-to-2 strong complementarity
// diagram that is not a corner case, it is the middle of the diagram.
//
// So the outline is that hull, cut back around the dots it must not hold: fat
// and convex wherever nothing is in the way, bending in around a foreign dot
// where one is. It is written as one distance per direction from the node — a
// reach — which keeps the boundary a single closed loop that cannot cross
// itself however deeply it has been cut, and makes "is this point inside" the
// same calculation as "where is the boundary".
//
// The cut leaves a corner where it rejoins the hull. Rounding those off by
// averaging the reach over a few degrees was tried and removed. Averaging can
// only pull the boundary *in*, which sounds safe and is the opposite: pulling
// in cannot break the clearance around a dot the blob avoids, but it cuts
// straight through the floor that keeps it off a dot the blob *holds*. It had
// the outline passing 6.3px from a dot drawn at 6px — all but touching it —
// where the floor alone gives the full 17.5px.

import { curvePointAt, edgeCurve, type Point } from '../curves'
import type { SceneLink } from '../types'
import type { HypergraphBlob } from './types'

/** How finely the outline is sampled, in samples per turn. Straight stretches
 *  come out exact whatever the rate — every sample sits on the boundary — so
 *  this only has to suit the curved parts, where 180 leaves an error well
 *  under a tenth of a pixel. */
const OUTLINE_SAMPLES = 180

/** How far clear of a foreign dot the outline passes, as a multiple of the
 *  radius that dot is *drawn* at. It is the dot you can see that the boundary
 *  is dodging, not the blob's own much larger radius — and this is the only
 *  thing that sets how much air there is around a dodged dot, so it is the
 *  knob to turn when a cut looks tight. */
const CLEARANCE = 2

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

/** Where a ray from the origin leaves the disc of radius `r` about `c`, or
 *  -Infinity when it misses. */
function discExit(dir: Point, c: Point, r: number): number {
  const projection = dir.x * c.x + dir.y * c.y
  const discriminant = projection * projection - (c.x * c.x + c.y * c.y) + r * r
  return discriminant < 0 ? Number.NEGATIVE_INFINITY : projection + Math.sqrt(discriminant)
}

/**
 * Where a ray from the origin leaves the capsule of radius `r` around the
 * segment `a`–`b`: through one of the round ends, or through a flat side.
 *
 * -Infinity when the ray misses it altogether, so callers can take the maximum
 * over several capsules and get the exit from their union.
 */
function capsuleExit(dir: Point, a: Point, b: Point, r: number): number {
  let exit = Math.max(discExit(dir, a, r), discExit(dir, b, r))

  const ex = b.x - a.x
  const ey = b.y - a.y
  const length = Math.hypot(ex, ey)
  if (length === 0) return exit
  const ux = ex / length
  const uy = ey / length

  // Distance from the segment's line is a signed cross product; at a flat-side
  // exit it is ±r, and the crossing has to land alongside the segment rather
  // than off one of its ends, which the round ends above have covered.
  const denominator = dir.x * uy - dir.y * ux
  if (Math.abs(denominator) > 1e-9) {
    const base = a.x * uy - a.y * ux
    for (const offset of [r, -r]) {
      const t = (base + offset) / denominator
      if (t < 0) continue
      const along = (t * dir.x - a.x) * ux + (t * dir.y - a.y) * uy
      if (along >= 0 && along <= length) exit = Math.max(exit, t)
    }
  }
  return exit
}

/** Where a ray from the origin first comes within `clearance` of `q`, or
 *  Infinity when it never does. */
function approachDistance(dir: Point, q: Point, clearance: number): number {
  const across = q.x * dir.y - q.y * dir.x
  if (Math.abs(across) >= clearance) return Number.POSITIVE_INFINITY
  const along = q.x * dir.x + q.y * dir.y
  const enter = along - Math.sqrt(clearance * clearance - across * across)
  // A foreign dot sitting right on top of the node cannot be kept out by
  // pulling the boundary in — that would collapse the blob to nothing — so it
  // is left to the membership assertion in the stories to complain about.
  return enter <= 0 ? Number.POSITIVE_INFINITY : enter
}

/** The two lengths a blob's outline depends on. They are different things and
 *  were briefly the same one, which had the boundary swerving around a circle
 *  four times the size of the dot it was avoiding. */
export interface BlobSizes {
  /** How far the outline stands off the dots the blob does hold. */
  radius: number
  /** Radius a dot is drawn at, which sets how far the outline keeps off a dot
   *  the blob doesn't hold. */
  dot: number
}

/** A blob's dots in the frame the reach is measured in: the ones it reaches
 *  out to, the ones it must not swallow, and the hull it would be if nothing
 *  were in the way. Built once per blob so the reach can be evaluated cheaply,
 *  many times. */
interface BlobShape {
  /** Where the reach is measured from, in scene coordinates: the average of
   *  the blob's own dots.
   *
   *  It has to be a point inside the shape, or one distance per direction
   *  would not describe the boundary — and the average of a set of points is
   *  always inside their hull. The node's own position would do that job too,
   *  and used to, but the node is not drawn in this view, so a hull taken over
   *  it wraps a point that isn't there — obvious the moment a dot is dragged
   *  away from its spider. A blob's shape now comes only from dots you can
   *  see. */
  centre: Point
  members: Point[]
  foreign: Point[]
  hull: Point[]
  radius: number
  clearance: number
}

function shapeOf(blob: HypergraphBlob, pos: Map<string, Point>, sizes: BlobSizes): BlobShape {
  const own = blob.dots.map(id => pos.get(id)).filter(p => p !== undefined)
  const centre = {
    x: own.reduce((sum, p) => sum + p.x, 0) / (own.length || 1),
    y: own.reduce((sum, p) => sum + p.y, 0) / (own.length || 1),
  }

  const ownIds = new Set(blob.dots)
  const members: Point[] = []
  const foreign: Point[] = []
  for (const [id, p] of pos) {
    const relative = { x: p.x - centre.x, y: p.y - centre.y }
    if (ownIds.has(id)) members.push(relative)
    else foreign.push(relative)
  }
  return {
    centre,
    members,
    foreign,
    hull: convexHull(members),
    radius: sizes.radius,
    clearance: CLEARANCE * sizes.dot,
  }
}

/**
 * How far the outline runs from the node in direction `dir` (a unit vector).
 * Three terms, in the order they matter:
 *
 * - the rounded convex hull of the node and its own dots, which is the whole
 *   shape when nothing is in the way;
 * - cut back short of any foreign dot the ray would otherwise run into, which
 *   is what bends the boundary in around one;
 * - but never inside the corridor out to one of its own dots, since dropping a
 *   dot it does hold would be a worse lie than holding one it doesn't.
 */
function reach(shape: BlobShape, angle: number): number {
  const { members, foreign, hull, radius, clearance } = shape
  const origin = { x: 0, y: 0 }
  const dir = { x: Math.cos(angle), y: Math.sin(angle) }

  let hullReach = radius
  if (hull.length === 1) {
    hullReach = Math.max(hullReach, discExit(dir, hull[0], radius))
  } else {
    for (let i = 0; i < hull.length; i++) {
      hullReach = Math.max(
        hullReach,
        capsuleExit(dir, hull[i], hull[(i + 1) % hull.length], radius),
      )
    }
  }

  let limit = Number.POSITIVE_INFINITY
  for (const q of foreign) {
    limit = Math.min(limit, approachDistance(dir, q, clearance))
  }

  let floor = radius
  for (const m of members) floor = Math.max(floor, capsuleExit(dir, origin, m, radius))

  return Math.max(floor, Math.min(hullReach, limit))
}

/**
 * The outline of a blob, walked round as one closed loop.
 *
 * Writing the boundary as a reach per direction is what keeps this simple:
 * the shape is star-shaped about the node by construction, so the loop cannot
 * cross itself however deeply the hull has been cut back, and there are no
 * overlapping pieces whose union has to be worked out.
 */
export function blobOutline(
  blob: HypergraphBlob,
  pos: Map<string, Point>,
  sizes: BlobSizes,
): string {
  const shape = shapeOf(blob, pos, sizes)
  if (shape.members.length === 0) return ''

  const points: string[] = []
  for (let i = 0; i < OUTLINE_SAMPLES; i++) {
    const angle = (2 * Math.PI * i) / OUTLINE_SAMPLES
    const r = reach(shape, angle)
    points.push(`${shape.centre.x + r * Math.cos(angle)} ${shape.centre.y + r * Math.sin(angle)}`)
  }
  return `M ${points.join(' L ')} Z`
}

/**
 * Whether a blob, as drawn, holds this point — the same reach the outline is
 * drawn from, so the two cannot disagree.
 *
 * Tested against the geometry rather than by asking the DOM what was clicked,
 * because blobs overlap: SVG hit-testing reports only the topmost path, and
 * which one that is says nothing about the others under the pointer.
 */
export function blobContains(
  blob: HypergraphBlob,
  pos: Map<string, Point>,
  sizes: BlobSizes,
  point: Point,
): boolean {
  const shape = shapeOf(blob, pos, sizes)
  if (shape.members.length === 0) return false
  const dx = point.x - shape.centre.x
  const dy = point.y - shape.centre.y
  const distance = Math.hypot(dx, dy)
  if (distance === 0) return true
  return distance <= reach(shape, Math.atan2(dy, dx))
}

/** Baseline for a blob's label: centred over it, just clear of the top of its
 *  outline. */
export function blobLabelAnchor(
  blob: HypergraphBlob,
  pos: Map<string, Point>,
  radius: number,
): Point | null {
  const own = blob.dots.map(id => pos.get(id)).filter(p => p !== undefined)
  if (own.length === 0) return null
  const x = own.reduce((sum, p) => sum + p.x, 0) / own.length
  const top = Math.min(...own.map(p => p.y))
  return { x, y: top - radius - 5 }
}

/** The middle of a blob — the point a leader line from its caption is aimed
 *  at. The same average of its own dots the reach is measured from, so it is
 *  inside the outline by construction: the floor keeps that reach positive in
 *  every direction. */
export function blobCentre(blob: HypergraphBlob, pos: Map<string, Point>): Point | null {
  const own = blob.dots.map(id => pos.get(id)).filter(p => p !== undefined)
  if (own.length === 0) return null
  return {
    x: own.reduce((sum, p) => sum + p.x, 0) / own.length,
    y: own.reduce((sum, p) => sum + p.y, 0) / own.length,
  }
}
