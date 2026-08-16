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

  const placed = new Set(dots.map(d => d.id))
  const blobs: HypergraphBlob[] = hg.hyperedges
    .map(e => ({
      id: e.id,
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
