// The curve a wire runs along, shared by everything that has to agree on it.
//
// `edgeCurve` is the single answer to "where does the wire between these two
// points go?": straight for a lone edge, a fanned quadratic arc for one of
// several parallel edges, a loop above the node for a self-edge. `curvePath`
// draws that curve and `curvePointAt` evaluates it — so the ZX viewer painting
// a wire and the hypergraph parking a dot halfway along it are reading the
// same geometry rather than two descriptions of it that have to be kept in
// step by hand.
//
// Deliberately free of every other concept in the package: points and numbers
// in, path strings and points out. `Point` lives here because it is the one
// type both sides of the package need.

export interface Point {
  x: number
  y: number
}

/** A curve between two points. The three cases are the three an edge can
 *  take, and each maps onto one SVG path command. */
export type Curve =
  | { kind: 'line'; from: Point; to: Point }
  | { kind: 'quadratic'; from: Point; control: Point; to: Point }
  | { kind: 'cubic'; from: Point; control1: Point; control2: Point; to: Point }

/**
 * Where the wire from `from` to `to` runs, given its position among the
 * `parallel` edges joining the same pair of nodes (`index`, 0-based).
 *
 * A lone edge is straight. Parallel edges bow out either side of the straight
 * line, evenly spread, so none of them is drawn on top of another. A self-edge
 * — the two endpoints coincide — loops up over the node instead, widening with
 * `index` for the same reason.
 */
export function edgeCurve(from: Point, to: Point, index: number, parallel: number): Curve {
  if (from.x === to.x && from.y === to.y) {
    const spread = parallel === 1 ? 40 : 20 + (index + 1) * 10
    return {
      kind: 'cubic',
      from,
      control1: { x: from.x - spread, y: from.y - spread },
      control2: { x: from.x + spread, y: from.y - spread },
      to,
    }
  }
  if (parallel === 1) return { kind: 'line', from, to }

  // The control point is pushed off the midpoint along the edge's normal, by
  // a fraction of the edge's own length — so the fan scales with the gap it
  // has to cross. `bow` runs from -0.5 to 0.5 across the parallel edges.
  const bow = index / (parallel - 1) - 0.5
  const dx = to.x - from.x
  const dy = to.y - from.y
  return {
    kind: 'quadratic',
    from,
    control: { x: 0.5 * (from.x + to.x) - bow * dy, y: 0.5 * (from.y + to.y) + bow * dx },
    to,
  }
}

/** The curve as an SVG path. */
export function curvePath(curve: Curve): string {
  const { from, to } = curve
  const start = `M ${from.x} ${from.y}`
  switch (curve.kind) {
    case 'line':
      return `${start} L ${to.x} ${to.y}`
    case 'quadratic':
      return `${start} Q ${curve.control.x} ${curve.control.y}, ${to.x} ${to.y}`
    case 'cubic':
      return (
        `${start} C ${curve.control1.x} ${curve.control1.y}, ` +
        `${curve.control2.x} ${curve.control2.y}, ${to.x} ${to.y}`
      )
  }
}

/** The point at `t` along the curve, `t` running 0 (at `from`) to 1 (at
 *  `to`) — the Bézier parameter, not arc length, so `t = 0.5` is the
 *  midpoint of the curve as drawn rather than of the distance travelled. */
export function curvePointAt(curve: Curve, t: number): Point {
  const { from, to } = curve
  const u = 1 - t
  switch (curve.kind) {
    case 'line':
      return { x: from.x + t * (to.x - from.x), y: from.y + t * (to.y - from.y) }
    case 'quadratic': {
      const a = u * u
      const b = 2 * u * t
      const c = t * t
      return {
        x: a * from.x + b * curve.control.x + c * to.x,
        y: a * from.y + b * curve.control.y + c * to.y,
      }
    }
    case 'cubic': {
      const a = u * u * u
      const b = 3 * u * u * t
      const c = 3 * u * t * t
      const d = t * t * t
      return {
        x: a * from.x + b * curve.control1.x + c * curve.control2.x + d * to.x,
        y: a * from.y + b * curve.control1.y + c * curve.control2.y + d * to.y,
      }
    }
  }
}
