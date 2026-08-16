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

import type { Point } from '../curves'
import { Topology } from '../topology'
import type { DiagramData, Scene } from '../types'
import { toHypergraph } from './convert'
import { wireDot } from './geometry'
import type { HypergraphBlob, HypergraphDot, HypergraphScene } from './types'

/** Blob standoff and dot radius, as fractions of the ZX layout's scale — the
 *  *unzoomed* one, so both shrink relative to the spacing as `ZOOM` grows. */
const BLOB_RADIUS = 0.35
const DOT_RADIUS = 0.12

/** How much roomier the hypergraph is drawn than the diagram it came from.
 *  Dots land on edge midpoints, so consecutive dots sit half a scale apart —
 *  half the ZX spacing for twice the marks. Zooming the positions (and not the
 *  blobs) spreads them back out and keeps neighbouring blobs apart. */
const ZOOM = 1.6

/**
 * Pull apart dots that landed on the very same point.
 *
 * Two edges that cross share a midpoint — in the 2-to-2 strong complementarity
 * diagram the wires 1—6 and 2—5 both sit dead centre — and one dot where there
 * should be two reads as a single wire four spiders share, which is a
 * different diagram. `layout()` already fans *parallel* edges apart through
 * `index`/`parallel`; this is the same problem for edges between different
 * pairs of nodes.
 *
 * Ties are exact, not near-misses: on an integer grid every midpoint is a
 * multiple of half a scale, so two dots are either the same point or half a
 * column apart. Spreading a tie is therefore all the placement needs — what it
 * cannot fix is a blob *shape* that swallows a dot it doesn't own, which is
 * why `blobOutline` draws a star rather than a hull.
 *
 * The group is spread in one pass rather than nudged apart one dot at a time,
 * for the same reason `Topology.resolve` spreads parked H-boxes that way: an
 * iterative nudge settles exactly on its own threshold, and rounding then
 * decides whether another nudge is due.
 *
 * Spreading is horizontal — *across* the column, not along it — and fills one
 * column pitch however big the group is. A tie lands in a column that already
 * holds other dots, so sliding along the column keeps the tied dots packed
 * among them; going across puts clear air between the two, which the blobs
 * reaching for them need. A pitch is as wide as it can go before reaching the
 * neighbouring column of dots.
 */
function spreadCoincident(dots: HypergraphDot[], pitch: number): void {
  const groups = new Map<string, HypergraphDot[]>()
  for (const dot of dots) {
    // A tenth of a pixel: this is looking for exact ties, not for crowding.
    const key = `${Math.round(dot.x * 10)},${Math.round(dot.y * 10)}`
    const group = groups.get(key)
    if (group) group.push(dot)
    else groups.set(key, [dot])
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue
    const step = pitch / (group.length - 1)
    const first = -pitch / 2
    group.forEach((dot, i) => {
      dot.x += first + i * step
    })
  }
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
  const pos = topology.resolve(base, topology.initialLineParams())

  const scale = scene.scale
  const blobRadius = BLOB_RADIUS * scale
  const dotSize = Math.max(DOT_RADIUS * scale, 2)

  // `hg.wires` and `scene.links` are both built from `diagram.edges` in order,
  // so wire i and link i are the same edge.
  const dots: HypergraphDot[] = []
  hg.wires.forEach((wire, i) => {
    const link = scene.links[i]
    const p = link ? wireDot(link, pos) : null
    if (!p) return
    dots.push({
      id: wire.id,
      x: p.x * ZOOM,
      y: p.y * ZOOM,
      kind: wire.kind,
      label: `${wire.src}—${wire.tgt}`,
    })
  })

  spreadCoincident(dots, scale * ZOOM)

  const placed = new Set(dots.map(d => d.id))
  const blobs: HypergraphBlob[] = hg.hyperedges
    .map(e => {
      // The node's own position, in the same zoomed space as the dots: a blob
      // reaches out from the node it stands for.
      const at = pos.get(e.nodeId) ?? { x: 0, y: 0 }
      return {
        id: e.id,
        x: at.x * ZOOM,
        y: at.y * ZOOM,
        name: e.name,
        phase: e.phase,
        kind: e.kind,
        dots: [...new Set(e.wires)].filter(w => placed.has(w)),
      }
    })
    .filter(b => b.dots.length > 0)

  // A dot sits at the midpoint of an edge, inside the box the ZX nodes span,
  // so a blob normally fits in the padding `layout()` already leaves. A
  // self-loop's dot is the exception — it rides above its node — so grow the
  // canvas to whatever the blobs actually need.
  let minX = 0
  let minY = 0
  let maxX = scene.width * ZOOM
  let maxY = scene.height * ZOOM
  for (const p of [...dots, ...blobs]) {
    minX = Math.min(minX, p.x - blobRadius)
    minY = Math.min(minY, p.y - blobRadius)
    maxX = Math.max(maxX, p.x + blobRadius)
    maxY = Math.max(maxY, p.y + blobRadius)
  }
  const shiftX = -Math.min(0, minX)
  const shiftY = -Math.min(0, minY)
  if (shiftX !== 0 || shiftY !== 0) {
    for (const p of [...dots, ...blobs]) {
      p.x += shiftX
      p.y += shiftY
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
