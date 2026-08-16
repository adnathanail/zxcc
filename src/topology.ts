// Adjacency-derived queries over a laid-out `Scene`: which nodes neighbour
// which, the H-box chains that runs of degree-2 H-boxes form, and the final
// positions those H-boxes resolve to.
//
// Shared, because both views need positions for the H-boxes the layout leaves
// unplaced: `<zx-viewer>` to paint them, the hypergraph layout to find the
// midpoint of a wire that ends on one. DOM-free, and holds no drawing state —
// it is built once per scene and reused across renders.

import type { Point } from './curves'
import type { NodeKind, Scene } from './types'

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

/** The point a fraction `t` of the way from `a` to `b`. */
function along(a: Point, b: Point, t: number): Point {
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
}
