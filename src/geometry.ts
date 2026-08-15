// Pure geometry for the viewer: H-box chain tracing, position resolution,
// and the SVG path strings for edges, Pauli strands, and boxes.
//
// Nothing here touches the DOM. `<zx-viewer>` keeps only the *inputs* to
// these functions as state (dragged positions, H-box line parameters,
// selection) and derives every coordinate it paints by calling them.

import type { NodeKind, Scene, SceneBox, SceneLink, SceneWeb } from './types'

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** An unbroken run of degree-2 H-boxes and the two non-H-box nodes it
 *  connects. `hboxes` is ordered from `a` to `b`; `index` is the position of
 *  the node the chain was traced from. */
export interface HboxChain {
  a: number
  b: number
  hboxes: number[]
  index: number
}

/**
 * Adjacency-derived queries over a `Scene`. Built once per scene and reused
 * across renders — it holds no mutable drawing state.
 */
export class Topology {
  readonly #kinds = new Map<number, NodeKind>()
  readonly #adj = new Map<number, number[]>()
  /** H-box ids in scene order, so barycentre placement stays deterministic. */
  readonly #hboxes: number[] = []
  readonly #autoHbox: boolean
  readonly #scale: number
  readonly #nodeSize: number
  /** Radius of the circle circumscribing an H-box's square, so a clearance
   *  built from it holds whatever angle the chain runs at. */
  readonly #hboxRadius: number

  constructor(scene: Scene) {
    this.#autoHbox = scene.autoHbox
    this.#scale = scene.scale
    this.#nodeSize = scene.nodeSize
    this.#hboxRadius = 0.75 * scene.nodeSize * Math.SQRT2
    for (const n of scene.nodes) {
      this.#kinds.set(n.id, n.kind)
      this.#adj.set(n.id, [])
      if (n.kind === 'hadamard') this.#hboxes.push(n.id)
    }
    for (const l of scene.links) {
      this.#adj.get(l.source)?.push(l.target)
      this.#adj.get(l.target)?.push(l.source)
    }
  }

  kindOf(id: number): NodeKind | undefined {
    return this.#kinds.get(id)
  }

  /** Radius of the circle enclosing a node as drawn — see the shape branches
   *  in the viewer. Used to keep a dragged H-box off whatever sits at the end
   *  of its chain, which is not always a full-size spider. */
  nodeRadius(id: number): number {
    switch (this.#kinds.get(id)) {
      case 'boundary':
        return 0.5 * this.#nodeSize
      case 'w-input':
        return 0.2 * this.#nodeSize
      case 'hadamard':
      case 'z-box':
        return this.#hboxRadius
      default:
        return this.#nodeSize
    }
  }

  #isHbox(id: number): boolean {
    return this.#kinds.get(id) === 'hadamard'
  }

  #isChainLink(id: number): boolean {
    return this.#isHbox(id) && this.#adj.get(id)?.length === 2
  }

  /** Walk away from `prev` through H-boxes until a non-H-box node is hit.
   *  Returns a null endpoint if the run dead-ends on a branching H-box or
   *  closes into an all-H-box cycle. */
  #trace(start: number, prev: number): { endpoint: number | null; chain: number[] } {
    const chain: number[] = []
    const seen = new Set<number>()
    let current = start
    let previous = prev
    while (this.#isChainLink(current)) {
      if (seen.has(current)) return { endpoint: null, chain }
      seen.add(current)
      chain.push(current)
      const nb = this.#adj.get(current) as number[]
      const next = nb[0] === previous ? nb[1] : nb[0]
      previous = current
      current = next
    }
    return { endpoint: this.#isHbox(current) ? null : current, chain }
  }

  chain(id: number): HboxChain | null {
    if (!this.#isChainLink(id)) return null
    const nb = this.#adj.get(id) as number[]
    const left = this.#trace(nb[0], id)
    const right = this.#trace(nb[1], id)
    if (left.endpoint === null || right.endpoint === null) return null
    return {
      a: left.endpoint,
      b: right.endpoint,
      hboxes: [...left.chain].reverse().concat(id, right.chain),
      index: left.chain.length,
    }
  }

  /** Even initial spacing for every H-box along its chain. */
  initialLineParams(): Map<number, number> {
    const params = new Map<number, number>()
    for (const id of this.#hboxes) {
      if (params.has(id)) continue
      const chain = this.chain(id)
      if (!chain) {
        params.set(id, 0.5)
        continue
      }
      chain.hboxes.forEach((h, i) => {
        params.set(h, (i + 1) / (chain.hboxes.length + 1))
      })
    }
    return params
  }

  /**
   * Where a dragged H-box is allowed to come to rest: a clearance short of
   * whatever is next along the chain, in either direction.
   *
   * Clearances are pixel distances — the shapes are a fixed size — while
   * `lineParam` is a fraction of the chain, so they are divided through by the
   * chain's length to convert. A flat `lineParam` margin would shrink to
   * nothing on a long chain and let the shapes intersect.
   */
  clampLineParam(
    chain: HboxChain,
    lineParams: Map<number, number>,
    value: number,
    pos: Map<number, Point>,
  ): number {
    const a = pos.get(chain.a)
    const b = pos.get(chain.b)
    if (!a || !b) return value
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    if (length === 0) return value

    const clearOf = (other: number) => (this.#hboxRadius + this.nodeRadius(other)) / length
    const { hboxes, index } = chain
    const prev = index > 0 ? hboxes[index - 1] : null
    const next = index < hboxes.length - 1 ? hboxes[index + 1] : null
    const min = prev !== null ? (lineParams.get(prev) ?? 0) + clearOf(prev) : clearOf(chain.a)
    const max = next !== null ? (lineParams.get(next) ?? 1) - clearOf(next) : 1 - clearOf(chain.b)

    // A chain too short to seat its H-boxes has no gap to clamp into;
    // splitting the difference keeps the box between its neighbours rather
    // than snapping it to one side.
    if (min > max) return (min + max) / 2
    return Math.max(min, Math.min(max, value))
  }

  /**
   * Final pixel positions: `base` for ordinary nodes, plus derived positions
   * for H-boxes when the scene asked for auto-placement — on their chain line
   * at `lineParams`, or offset from the barycentre of their non-H-box
   * neighbours when they have no chain.
   */
  resolve(base: Map<number, Point>, lineParams: Map<number, number>): Map<number, Point> {
    const pos = new Map(base)
    if (!this.#autoHbox) return pos

    // An H-box with a chain sits at a definite point on its line. The rest
    // park at the barycentre of their non-H-box neighbours, nudged north-east.
    const parked = new Map<string, number[]>()
    for (const id of this.#hboxes) {
      const chain = this.chain(id)
      if (chain) {
        const a = pos.get(chain.a)
        const b = pos.get(chain.b)
        if (a && b) pos.set(id, along(a, b, lineParams.get(id) ?? 0.5))
        continue
      }

      const neighbours = (this.#adj.get(id) ?? []).filter(n => !this.#isHbox(n))
      if (neighbours.length === 0) continue
      let x = 0
      let y = 0
      for (const n of neighbours) {
        const p = pos.get(n)
        if (p) {
          x += p.x
          y += p.y
        }
      }
      const point = {
        x: x / neighbours.length + 0.25 * this.#scale,
        y: y / neighbours.length - 0.25 * this.#scale,
      }
      pos.set(id, point)
      const key = `${point.x},${point.y}`
      const group = parked.get(key)
      if (group) group.push(id)
      else parked.set(key, [id])
    }

    // H-boxes over the same neighbours want the same point, so spread each
    // such group along x, centred on the point they share. Solving the whole
    // group at once keeps this a pure function of the node positions: nudging
    // boxes one at a time until they stop colliding lands exactly on the
    // clearance, where rounding decides whether another nudge is due, and the
    // box visibly flicks between two spots as the diagram is dragged.
    //
    // Only each other is dodged: a diagram is free to pack its nodes
    // arbitrarily close, and a box that fled every spider would end up
    // somewhere less predictable.
    const clearance = 2 * this.#hboxRadius
    for (const group of parked.values()) {
      if (group.length < 2) continue
      const first = -((group.length - 1) / 2) * clearance
      group.forEach((id, i) => {
        const p = pos.get(id) as Point
        pos.set(id, { x: p.x + first + i * clearance, y: p.y })
      })
    }
    return pos
  }
}

export function along(a: Point, b: Point, t: number): Point {
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
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
 *  a loop above the node for self-edges. */
export function linkPath(link: SceneLink, pos: Map<number, Point>): string {
  const s = pos.get(link.source)
  const t = pos.get(link.target)
  if (!s || !t) return ''

  if (s.x === t.x && s.y === t.y) {
    const spread = link.parallel === 1 ? 40 : 20 + (link.index + 1) * 10
    return `M ${s.x} ${s.y} C ${s.x - spread} ${s.y - spread}, ${s.x + spread} ${s.y - spread}, ${t.x} ${t.y}`
  }
  if (link.parallel === 1) return `M ${s.x} ${s.y} L ${t.x} ${t.y}`

  const dx = t.x - s.x
  const dy = t.y - s.y
  const midX = 0.5 * (s.x + t.x)
  const midY = 0.5 * (s.y + t.y)
  const bow = link.index / (link.parallel - 1) - 0.5
  return `M ${s.x} ${s.y} Q ${midX - bow * dy} ${midY + bow * dx}, ${t.x} ${t.y}`
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
 *  decreasing width. `s = size / 2` matches d3.symbol()'s handoff to
 *  symbolGround.draw(). */
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
