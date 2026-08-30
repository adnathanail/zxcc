// Pixel-space layout for the hypergraph view — the stage that turns the
// `Scene` both views are built on into the dual picture:
//
//   Scene --layoutHypergraph()--> HypergraphInput --hypergraphScene()--> …
//
// It stops at the *input*, not at the scene: a pixel-positioned
// `HypergraphInput` is the public way of saying "these dots, exactly here", so
// what comes out is the same thing a caller could have written by hand and goes
// through the same builder and the same checks. That is what lets
// `<zx-diagram>` mount a `<zx-hypergraph>` for its dual rather than a painter.
//
// Positions come from the scene rather than from the hypergraph itself: a
// wire's dot sits at the midpoint of the edge it came from, so the two views
// line up and the dual reads as an overlay on the diagram. The cost is that the
// blobs land wherever the ZX layout leaves them, rather than being arranged to
// keep the overlaps tidy.
//
// Taking a laid-out scene rather than laying the diagram out here also keeps
// this half of `src/` independent of the other: `layout()` sits above both, and
// the caller runs it once.

import { type Curve, curvePointAt, type Point } from '../curves'
import { Topology } from '../topology'
import type { DiagramData, Scene } from '../types'
import { toHypergraph } from './convert'
import { wireCurve } from './geometry'
import type { HypergraphInput, HypergraphInputHyperedge, HypergraphInputPixelWire } from './types'

/** Blob standoff and dot radius, as fractions of the ZX layout's scale — the
 *  *unzoomed* one, so both shrink relative to the spacing as `ZOOM` grows. */
const BLOB_RADIUS = 0.35
const DOT_RADIUS = 0.12

/** How much roomier the hypergraph is drawn than the diagram it came from.
 *  Dots land on edge midpoints, so consecutive dots sit half a scale apart —
 *  half the ZX spacing for twice the marks. Zooming the positions, and not the
 *  blobs, spreads them back out and keeps neighbouring blobs apart.
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

/** Dot radius and blob standoff for a given scale. Every hypergraph is measured
 *  through this — `./scene.ts` for the drawing itself, and this file for the
 *  spread step and the canvas — so a hand-written drawing and a derived one
 *  come out at the same weights at the same scale. */
export function sceneMetrics(scale: number): { dotSize: number; blobRadius: number } {
  return { dotSize: Math.max(DOT_RADIUS * scale, 2), blobRadius: BLOB_RADIUS * scale }
}

/** A wire's dot, and the curve it is free to slide along. */
interface Rider {
  wire: HypergraphInputPixelWire
  curve: Curve
  t: number
}

/**
 * Pull apart dots that landed on top of one another, by sliding each along its
 * own wire.
 *
 * Two edges that cross share a midpoint — in the 2-to-2 strong complementarity
 * diagram the wires 2—5 and 3—4 both sit dead centre — and one dot where there
 * should be two reads as a single wire four spiders share. `layout()` fans
 * *parallel* edges apart through `index`/`parallel`; this is the same problem
 * for edges between different pairs of nodes.
 *
 * Each dot slides along its own wire rather than the group being pushed down
 * the column. Consecutive midpoints already sit half a ZX scale apart down a
 * column, so spreading that way reaches into the neighbouring slots and lands
 * on their dots; the wires run in different directions, so sliding opens the
 * group out across the empty gap between the ranks instead.
 *
 * A slid dot is still on the wire it stands for, `wireCurve` being the same
 * curve the ZX viewer paints, which is what matters for reading the hypergraph
 * as an overlay. Sitting at the exact midpoint is not: two wires can share that
 * point, and then it says nothing.
 *
 * The group is opened in one pass rather than nudged apart a pair at a time,
 * as `Topology.resolve` spreads parked H-boxes: an iterative nudge settles
 * exactly on its own threshold, where rounding decides whether another round is
 * due, and the dot then flicks between two spots as the diagram is dragged.
 */
function spreadCoincident(riders: Rider[], gap: number, at: (rider: Rider) => Point): void {
  // Groups are single-linkage within `gap` rather than exact ties. Exact ties
  // are what the crossing-edge case produces on an integer grid, but a diagram
  // that arrives pre-positioned from the algebraic ZX walker is on no grid at
  // all, and two dots a pixel apart are as unreadable as two on one spot.
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

/** What the caller can vary about the drawing, as opposed to about the diagram. */
export interface HypergraphLayoutOptions {
  /** Draw a single-dot blob for each input/output as well as a blob for each
   *  spider. With it off, a boundary leg and a self-loop are indistinguishable.
   *  Required rather than defaulted, so that `<zx-diagram>`'s
   *  `disableIOBlobsInHypergraph` is the only place the default is stated. */
  boundaryBlobs: boolean
}

/**
 * Lay out the hypergraph dual of `diagram`, positioned from `scene` — the
 * result of `layout(diagram)`, which the caller supplies so that both views
 * are drawn from one and the same layout.
 *
 * The result is a pixel-positioned `HypergraphInput`, carrying its own canvas:
 * everything about where the drawing goes is decided here, and
 * `hypergraphScene` only measures the weights and checks it over.
 *
 * Throws by way of `toHypergraph` on a node that has no blob shape — spiders,
 * Hadamards and boundaries have one — so everything from here on has a shape
 * and a colour to be drawn with.
 */
export function layoutHypergraph(
  diagram: DiagramData,
  scene: Scene,
  { boundaryBlobs }: HypergraphLayoutOptions,
): HypergraphInput {
  const hg = toHypergraph(diagram, scene)

  // H-boxes carry no grid position, so their pixel positions are the ones the
  // viewer would derive; resolving them here keeps a dot on an H-box's wire
  // from being pinned to the top-left placeholder.
  const topology = new Topology(scene)
  const base = new Map<number, Point>(scene.nodes.map(n => [n.id, { x: n.x, y: n.y }]))
  const resolved = topology.resolve(base, topology.initialLineParams())

  // Zoom before building the curves, not after evaluating them: a self-loop's
  // arc stands a fixed number of pixels above its node rather than a fraction
  // of anything, so the loop around a node at `p` is not the loop around one at
  // `p * ZOOM` scaled up. Building from zoomed positions is what puts a
  // self-loop's dot on the loop `<zx-viewer>` paints. Every other curve shape
  // is proportional to the gap it spans and comes out the same either way.
  const pos = new Map<number, Point>(
    [...resolved].map(([id, p]) => [id, { x: p.x * ZOOM, y: p.y * ZOOM }]),
  )

  const scale = scene.scale
  const { dotSize, blobRadius } = sceneMetrics(scale)

  // `hg.wires` and `scene.links` are both built from `diagram.edges` in order,
  // so wire i and link i are the same edge.
  const riders: Rider[] = []
  // Where each surviving wire ended up in the emitted list, by its hypergraph
  // id: a wire whose link has no curve is dropped, so the two can diverge and a
  // hyperedge's wire indices have to be looked up rather than assumed.
  const index = new Map<string, number>()
  hg.wires.forEach((wire, i) => {
    const link = scene.links[i]
    const curve = link ? wireCurve(link, pos) : null
    if (!curve) return
    index.set(wire.id, riders.length)
    riders.push({
      curve,
      t: 0.5,
      // `id` is the wire's own edge index, which is what a selection names it
      // by — the language `<zx-viewer>` reads the same selection in.
      wire: { x: 0, y: 0, kind: wire.kind, id: i },
    })
  })

  const at = (rider: Rider): Point => curvePointAt(rider.curve, rider.t)

  spreadCoincident(riders, TIE_GAP * dotSize, at)

  const wires: HypergraphInputPixelWire[] = riders.map(rider => {
    const p = at(rider)
    rider.wire.x = p.x
    rider.wire.y = p.y
    return rider.wire
  })

  const hyperedges: HypergraphInputHyperedge[] = hg.hyperedges
    .filter(e => boundaryBlobs || e.kind !== 'boundary')
    .map(e => ({
      kind: e.kind,
      name: e.name,
      phase: e.phase,
      // The ZX node id, which is what a selection names the blob by.
      id: e.nodeId,
      wires: [...new Set(e.wires)].map(w => index.get(w)).filter(i => i !== undefined),
    }))
    .filter(e => e.wires.length > 0)

  // The canvas is the scene's own, zoomed — but only the drawing is zoomed.
  // `layout()` reserves a strip of a fixed number of pixels under the drawing
  // for the scalar, and a fixed number of pixels is the same distance at any
  // zoom, so the strip is carried across as it stands. That is what makes the
  // pair come out the same height in a `both` mode, where the graph is laid out
  // at `scale * ZOOM` and gets the same strip under it. The dual paints no
  // scalar but keeps the strip, and writes the trespass tally in it.
  //
  // Measured here rather than in `hypergraphScene` for the same reason the
  // positions are: a canvas measured around the dots would be whatever size the
  // dots happened to need, rather than lining up with the diagram.
  const scalarStrip = scene.height - scene.diagramHeight
  let minX = 0
  let minY = 0
  let maxX = scene.width * ZOOM
  // A dot sits at the midpoint of an edge, inside the box the ZX nodes span,
  // so a blob normally fits in the padding `layout()` already leaves. A
  // self-loop's dot is the exception — it rides above its node — so grow the
  // canvas to whatever the blobs actually need.
  let maxY = scene.diagramHeight * ZOOM + scalarStrip
  for (const w of wires) {
    minX = Math.min(minX, w.x - blobRadius)
    minY = Math.min(minY, w.y - blobRadius)
    maxX = Math.max(maxX, w.x + blobRadius)
    maxY = Math.max(maxY, w.y + blobRadius)
  }
  const shiftX = -Math.min(0, minX)
  const shiftY = -Math.min(0, minY)
  if (shiftX !== 0 || shiftY !== 0) {
    for (const w of wires) {
      w.x += shiftX
      w.y += shiftY
    }
  }

  return { wires, hyperedges, width: maxX + shiftX, height: maxY + shiftY }
}
