// Pixel-space layout for the hypergraph view — the stage that turns the
// `Scene` both views are built on into the dual picture:
//
//   Scene --layoutHypergraph()--> HypergraphScene --<zx-hypergraph-viewer>--> SVG
//
// Positions come from that scene rather than from the hypergraph itself: a
// wire's dot sits at the midpoint of the edge it came from, so the two views
// line up and the drawn hypergraph reads as an overlay on the diagram it came
// from. The cost is that the blobs are wherever the ZX layout leaves them,
// rather than arranged to keep the overlaps tidy.
//
// Taking the laid-out scene rather than laying the diagram out itself is also
// what keeps this half of `src/` independent of the other: `layout()` sits
// above both, and the caller runs it once.

import { type Curve, curvePointAt, type Point } from '../curves'
import { Topology } from '../topology'
import type { DiagramData, Scene } from '../types'
import { toHypergraph } from './convert'
import { wireCurve } from './geometry'
import type { HypergraphBlob, HypergraphDot, HypergraphScene } from './types'

/** Blob standoff and dot radius, as fractions of the ZX layout's scale — the
 *  *unzoomed* one, so both shrink relative to the spacing as `ZOOM` grows. */
const BLOB_RADIUS = 0.35
const DOT_RADIUS = 0.12

/** How much roomier the hypergraph is drawn than the diagram it came from.
 *  Dots land on edge midpoints, so consecutive dots sit half a scale apart —
 *  half the ZX spacing for twice the marks. Zooming the positions (and not the
 *  blobs) spreads them back out and keeps neighbouring blobs apart.
 *
 *  Exported because it is the factor between the two views' pixel sizes:
 *  `<zx-diagram>` lays the graph out at `scale * ZOOM` when it draws both, so
 *  the pair comes out the same width and a dot lands under its own wire. */
export const ZOOM = 1.6

/** How far apart two dots have to sit to read as two marks rather than one
 *  blot, centre to centre, in dot radii. In dots rather than in fractions of
 *  the grid because that is the actual question — whether you can see that
 *  there are two of them. */
const TIE_GAP = 3

/** A slid dot stays within the middle half of its wire, so it never ends up
 *  against a spider, where it would read as that spider's mark rather than the
 *  wire's. */
const T_MIN = 0.25
const T_MAX = 0.75

/** A dot, and the curve it is free to slide along. */
interface Rider {
  dot: HypergraphDot
  curve: Curve
  t: number
}

/**
 * Pull apart dots that landed on top of one another, by sliding each along its
 * own wire.
 *
 * Two edges that cross share a midpoint — in the 2-to-2 strong complementarity
 * diagram the wires 2—5 and 3—4 both sit dead centre — and one dot where there
 * should be two reads as a single wire four spiders share, which is a
 * different diagram. `layout()` already fans *parallel* edges apart through
 * `index`/`parallel`; this is the same problem for edges between different
 * pairs of nodes.
 *
 * Sliding is what makes the fix two-dimensional without giving up what a dot
 * means. The obvious move — push the group apart along the column — spreads
 * into the one direction that is already full: consecutive midpoints are half
 * a ZX scale apart down the same column, so a group of three or more reaches
 * into its neighbours' slots and lands on *their* dots. Measured on the n-to-m
 * story, spreading down the column re-creates exactly the collision it is
 * meant to remove, from 4-by-4 up. Each wire runs in its own direction, so
 * sliding each dot along its own wire opens the group out across the gap
 * between the ranks, which is empty.
 *
 * A dot that moves off the midpoint is still *on the wire it stands for* —
 * `wireCurve` is the same curve the ZX viewer paints — which is the property
 * that matters for reading the hypergraph as an overlay on the diagram. Being
 * at the exact midpoint is not: two wires can share that point, and then it
 * says nothing.
 *
 * The group is opened in one pass rather than nudged apart a pair at a time,
 * for the same reason `Topology.resolve` spreads parked H-boxes that way: an
 * iterative nudge settles exactly on its own threshold, and rounding then
 * decides whether another round is due.
 */
function spreadCoincident(riders: Rider[], gap: number, at: (rider: Rider) => Point): void {
  // Groups are single-linkage within `gap` rather than exact ties. Exact is
  // what the crossing-edge case produces on an integer grid, but a diagram
  // that arrives pre-positioned from the algebraic ZX walker is on no grid at
  // all, and two dots a pixel apart are just as unreadable as two on one spot.
  const grouped = new Set<Rider>()
  for (const rider of riders) {
    if (grouped.has(rider)) continue
    const group = [rider]
    grouped.add(rider)
    for (let i = 0; i < group.length; i++) {
      const here = at(group[i])
      for (const other of riders) {
        if (grouped.has(other)) continue
        const there = at(other)
        if (Math.hypot(here.x - there.x, here.y - there.y) < gap) {
          group.push(other)
          grouped.add(other)
        }
      }
    }
    if (group.length < 2) continue

    // Step in distance, not in `t`: `t` is the Bézier parameter, so the same
    // step covers different ground on a long wire than on a short one, and no
    // ground at all where a self-loop doubles back. Dividing by how fast the
    // dot moves at the midpoint converts the gap we want into the step that
    // gets it.
    const first = -((group.length - 1) / 2)
    group.forEach((member, i) => {
      member.t = clampT(0.5 + ((first + i) * gap) / speed(member, at))
    })
  }
}

function clampT(t: number): number {
  return Math.max(T_MIN, Math.min(T_MAX, t))
}

/** How far the dot moves per unit of `t`, measured either side of where it
 *  sits rather than derived, so it holds for the fanned arcs of parallel edges
 *  and for a self-loop as well as for a straight wire. */
function speed(rider: Rider, at: (rider: Rider) => Point): number {
  const step = 0.02
  const behind = at({ ...rider, t: clampT(rider.t - step) })
  const ahead = at({ ...rider, t: clampT(rider.t + step) })
  return Math.hypot(ahead.x - behind.x, ahead.y - behind.y) / (2 * step) || 1
}

/**
 * Lay out the hypergraph dual of `diagram`, positioned from `scene` — the
 * result of `layout(diagram)`, which the caller supplies so that both views
 * are drawn from one and the same layout.
 *
 * Throws by way of `toHypergraph` on a node that has no blob shape — only
 * spiders and Hadamards do — so everything from here on has a shape and a
 * colour to be drawn with.
 */
export function layoutHypergraph(diagram: DiagramData, scene: Scene): HypergraphScene {
  const hg = toHypergraph(diagram)

  // H-boxes carry no grid position, so their pixel positions are the ones the
  // viewer would derive; resolving them here keeps a dot on an H-box's wire
  // from being pinned to the top-left placeholder.
  const topology = new Topology(scene)
  const base = new Map<number, Point>(scene.nodes.map(n => [n.id, { x: n.x, y: n.y }]))
  const resolved = topology.resolve(base, topology.initialLineParams())

  // Zoomed before the curves are built, not after they are evaluated: a
  // self-loop's arc is a fixed number of pixels above its node rather than a
  // fraction of anything, so the loop drawn around a node at `p` is not the loop
  // drawn around one at `p * ZOOM` scaled up. Building from these positions is
  // what puts a self-loop's dot on the loop `<zx-viewer>` paints. Every other
  // curve shape is proportional to the gap it spans and comes out identical
  // either way.
  const pos = new Map<number, Point>(
    [...resolved].map(([id, p]) => [id, { x: p.x * ZOOM, y: p.y * ZOOM }]),
  )

  const scale = scene.scale
  const blobRadius = BLOB_RADIUS * scale
  const dotSize = Math.max(DOT_RADIUS * scale, 2)

  // `hg.wires` and `scene.links` are both built from `diagram.edges` in order,
  // so wire i and link i are the same edge.
  const riders: Rider[] = []
  hg.wires.forEach((wire, i) => {
    const link = scene.links[i]
    const curve = link ? wireCurve(link, pos) : null
    if (!curve) return
    riders.push({
      curve,
      t: 0.5,
      dot: {
        id: wire.id,
        x: 0,
        y: 0,
        kind: wire.kind,
        // The dot's own edge index, rather than its position in `dots`: a wire
        // whose link has no curve is dropped, so the two can diverge.
        edge: i,
        src: wire.src,
        tgt: wire.tgt,
        label: `${wire.src}—${wire.tgt}`,
      },
    })
  })

  const at = (rider: Rider): Point => curvePointAt(rider.curve, rider.t)

  spreadCoincident(riders, TIE_GAP * dotSize, at)

  const dots: HypergraphDot[] = riders.map(rider => {
    const p = at(rider)
    rider.dot.x = p.x
    rider.dot.y = p.y
    return rider.dot
  })

  const placed = new Set(dots.map(d => d.id))
  const blobs: HypergraphBlob[] = hg.hyperedges
    .map(e => ({
      id: e.id,
      nodeId: e.nodeId,
      name: e.name,
      phase: e.phase,
      kind: e.kind,
      dots: [...new Set(e.wires)].filter(w => placed.has(w)),
    }))
    .filter(b => b.dots.length > 0)

  // A dot sits at the midpoint of an edge, inside the box the ZX nodes span,
  // so a blob normally fits in the padding `layout()` already leaves. A
  // self-loop's dot is the exception — it rides above its node — so grow the
  // canvas to whatever the blobs actually need.
  let minX = 0
  let minY = 0
  let maxX = scene.width * ZOOM
  let maxY = scene.height * ZOOM
  for (const d of dots) {
    minX = Math.min(minX, d.x - blobRadius)
    minY = Math.min(minY, d.y - blobRadius)
    maxX = Math.max(maxX, d.x + blobRadius)
    maxY = Math.max(maxY, d.y + blobRadius)
  }
  const shiftX = -Math.min(0, minX)
  const shiftY = -Math.min(0, minY)
  if (shiftX !== 0 || shiftY !== 0) {
    for (const d of dots) {
      d.x += shiftX
      d.y += shiftY
    }
  }

  return {
    dots,
    blobs,
    width: maxX + shiftX,
    height: maxY + shiftY,
    scale,
    dotSize,
    blobRadius,
  }
}
