// `<zx-viewer>` — paints a laid-out `Scene` as SVG and owns the pointer
// interactions (drag, shift/brush selection).
//
// The whole SVG is a Lit template derived from four pieces of interaction
// state: dragged positions, H-box line parameters, the selection, and the
// live brush rect. Nothing else is stored — H-box positions, box bounds and
// edge paths are all recomputed from those in `render()`, which is why
// there is no imperative "sync the DOM to the model" pass. Three of the four
// are the viewer's own; the selection is the host's, so that the two views can
// share one (see `src/selection.ts`).
//
// Internal to the package: it renders into the light DOM so it shares
// `<zx-diagram>`'s stylesheet and leaves the SVG reachable from the host's
// shadow root.

import { html, LitElement, nothing, type PropertyValues, type SVGTemplateResult, svg } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import {
  edgeColor,
  LABEL_FILL,
  nodeColor,
  ORIGINAL_COLORS,
  PHASE_FILL,
  SELECTED_STROKE,
  webColor,
} from '../colors'
import type { Point } from '../curves'
import { EMPTY_SELECTION, nodeSelection, type Selection, selectionEvent } from '../selection'
import { Topology } from '../topology'
import type { BoxKind, NodeKind, Scene, SceneNode } from '../types'
import {
  boxBounds,
  groundSymbolPath,
  lineParamDelta,
  linkPath,
  type Rect,
  webPath,
} from './geometry'

const SELECTED_STYLE = `stroke-width: 2px; stroke: ${SELECTED_STROKE}`
const NODE_STYLE = 'stroke-width: 1.5px'
const LINK_STYLE = 'stroke-width: 1.5px'
/** A selected edge is repainted in the selection blue and thickened. Taking
 *  the colour over means an H-edge stops reading as an H-edge while it is
 *  picked out — a marker that keeps the edge's own colour is the better
 *  answer, and is what this should become. */
const SELECTED_LINK_STYLE = 'stroke-width: 2.5px'

const BOX_STYLE: Record<BoxKind, { fill: string; stroke: string; dash: string }> = {
  stack: { fill: 'rgba(255,165,80,0.10)', stroke: 'rgba(220,130,30,0.65)', dash: '4 3' },
  compose: { fill: 'rgba(100,160,255,0.10)', stroke: 'rgba(50,110,220,0.65)', dash: '0' },
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/** Shift or meta extends the selection instead of replacing it. */
function isAdditive(e: MouseEvent): boolean {
  return e.shiftKey || e.metaKey
}

@customElement('zx-viewer')
export class ZxViewerElement extends LitElement {
  @property({ attribute: false }) scene: Scene | null = null
  @property({ attribute: false }) colors: Record<string, string> = ORIGINAL_COLORS
  /** Draw each node's id above it (pyzx's `draw_d3(labels=...)`). */
  @property({ attribute: false }) showLabels = true
  /** Extra SVG painted on top of the diagram, in its coordinate space. The
   *  host uses it for the attribution badge; the viewer just renders it. */
  @property({ attribute: false }) overlay: SVGTemplateResult | null = null
  /** What is picked out. The viewer is *controlled*: a gesture announces the
   *  selection it makes as a `zx-selection` event and draws whatever the host
   *  hands back, so the same selection can drive the other view too.
   *  Selected edges are drawn but never selected here — they come from a press
   *  on a dot in the hypergraph, where an edge is a thing you can point at. */
  @property({ attribute: false }) selection: Selection = EMPTY_SELECTION

  /** Positions the user has dragged nodes to, seeded from the scene. H-boxes
   *  under auto-placement are overridden by `#lineParams` in `resolve()`. */
  #base = new Map<number, Point>()
  #lineParams = new Map<number, number>()
  #brush: Rect | null = null
  #topology: Topology | null = null
  /** Tears down the in-flight drag or brush gesture, if any. */
  #endGesture: (() => void) | null = null

  // These are deliberately not `@state()`: they are mutated in place during a
  // gesture and paired with an explicit `requestUpdate()`, rather than being
  // reallocated on every mousemove just to trip Lit's identity check.

  protected createRenderRoot() {
    return this
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('scene')) this.#adoptScene()
  }

  disconnectedCallback() {
    this.#endGesture?.()
    super.disconnectedCallback()
  }

  /** Reset all interaction state to the freshly laid-out scene. The selection
   *  isn't reset here — it belongs to the host, which clears it when it lays
   *  a new scene out. */
  #adoptScene() {
    this.#endGesture?.()
    const scene = this.scene
    this.#topology = scene ? new Topology(scene) : null
    this.#base = new Map(scene?.nodes.map(n => [n.id, { x: n.x, y: n.y }]) ?? [])
    this.#lineParams = this.#topology?.initialLineParams() ?? new Map()
    this.#brush = null
  }

  /** Announce a selection of nodes. What comes back through `selection` is
   *  what gets drawn — here and in the other view. */
  #select(nodes: Iterable<number>) {
    this.dispatchEvent(selectionEvent(nodeSelection(nodes)))
  }

  /** Run `onMove` for the rest of this gesture. Window-level listeners keep
   *  the drag alive when the pointer leaves the SVG. */
  #track(onMove: (e: MouseEvent) => void, onEnd?: () => void) {
    this.#endGesture?.()
    const up = () => this.#endGesture?.()
    this.#endGesture = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', up)
      this.#endGesture = null
      onEnd?.()
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', up)
  }

  #positions(): Map<number, Point> {
    return this.#topology?.resolve(this.#base, this.#lineParams) ?? new Map()
  }

  #onNodeDown = (e: MouseEvent) => {
    if (e.button !== 0) return
    const group = (e.target as Element).closest('[data-node]')
    if (!group) return
    const id = Number(group.getAttribute('data-node'))

    const selected = this.selection.nodes
    let next = selected
    if (isAdditive(e)) {
      const toggled = new Set(selected)
      if (toggled.has(id)) toggled.delete(id)
      else toggled.add(id)
      next = toggled
      e.stopImmediatePropagation()
    } else if (!selected.has(id)) {
      next = new Set([id])
    }
    if (next !== selected) this.#select(next)

    // The drag starts even on an additive click, so shift-clicking a node and
    // moving in the same gesture drags the selection it just extended. It
    // moves the set this press *makes* rather than re-reading `selection`,
    // which only comes back from the host on the next update.
    let lastX = e.clientX
    let lastY = e.clientY
    this.#track(move => {
      const dx = move.clientX - lastX
      const dy = move.clientY - lastY
      lastX = move.clientX
      lastY = move.clientY
      this.#dragSelection(next, dx, dy)
    })
  }

  #dragSelection(nodes: ReadonlySet<number>, dx: number, dy: number) {
    const scene = this.scene
    const topology = this.#topology
    if (!scene || !topology) return
    const pos = this.#positions()

    for (const id of nodes) {
      // An auto-placed H-box slides along its chain rather than moving
      // freely; one without a chain just follows its neighbours.
      if (scene.autoHbox && topology.kindOf(id) === 'hadamard') {
        const chain = topology.chain(id)
        const a = chain && pos.get(chain.a)
        const b = chain && pos.get(chain.b)
        if (!chain || !a || !b) continue
        const delta = lineParamDelta(a, b, dx, dy)
        if (delta === null) continue
        const moved = (this.#lineParams.get(id) ?? 0.5) + delta
        this.#lineParams.set(id, topology.clampLineParam(chain, this.#lineParams, moved, pos))
        continue
      }
      const p = this.#base.get(id)
      if (p) this.#base.set(id, { x: p.x + dx, y: p.y + dy })
    }
    this.requestUpdate()
  }

  #onBrushDown = (e: MouseEvent) => {
    if (e.button !== 0) return
    const scene = this.scene
    const svgEl = (e.currentTarget as SVGElement).ownerSVGElement
    if (!scene || !svgEl) return

    const origin = svgEl.getBoundingClientRect()
    const startX = e.clientX - origin.left
    const startY = e.clientY - origin.top
    // Nodes selected before the brush started survive it, but a node covered
    // by the brush toggles — so re-brushing an already-selected node drops it.
    const kept = isAdditive(e) ? new Set(this.selection.nodes) : new Set<number>()
    this.#select(kept)

    this.#track(
      move => {
        const box = svgEl.getBoundingClientRect()
        const x = clamp(move.clientX - box.left, 0, scene.width)
        const y = clamp(move.clientY - box.top, 0, scene.height)
        const rect: Rect = {
          x: Math.min(startX, x),
          y: Math.min(startY, y),
          width: Math.abs(x - startX),
          height: Math.abs(y - startY),
        }
        this.#brush = rect
        const pos = this.#positions()
        const next = new Set<number>()
        for (const n of scene.nodes) {
          const p = pos.get(n.id)
          const inside =
            !!p &&
            rect.x <= p.x &&
            p.x < rect.x + rect.width &&
            rect.y <= p.y &&
            p.y < rect.y + rect.height
          if (kept.has(n.id) !== inside) next.add(n.id)
        }
        this.#select(next)
        // The brush rect is the viewer's own, so it still has to ask for the
        // render that draws it; the selection arrives on the host's cycle.
        this.requestUpdate()
      },
      () => {
        this.#brush = null
        this.requestUpdate()
      },
    )
  }

  /** The node's body: a circle for spiders, boundaries and W-inputs, a square
   *  for H-boxes and Z-boxes, a triangle for W-outputs. */
  #renderShape(kind: NodeKind, size: number, style: string) {
    const fill = nodeColor(kind, this.colors)
    if (kind === 'hadamard' || kind === 'z-box') {
      return svg`<rect
        x=${-0.75 * size} y=${-0.75 * size}
        width=${1.5 * size} height=${1.5 * size}
        fill=${fill} stroke="black" class="selectable" style=${style} />`
    }
    if (kind === 'w-output') {
      return svg`<path
        d=${`M 0 0 L ${size} ${size} L ${-size} ${size} Z`}
        transform=${`translate(${-size / 2}, 0) rotate(-90)`}
        fill=${fill} stroke="black" class="selectable" style=${style} />`
    }
    const r = kind === 'boundary' ? 0.5 * size : kind === 'w-input' ? 0.2 * size : size
    return svg`<circle r=${r} fill=${fill} stroke="black" class="selectable" style=${style} />`
  }

  /** Stem plus pyzx ground symbol, hanging below a grounded vertex. */
  #renderGround(size: number, style: string) {
    const offset = 2.5 * size
    return svg`
      <path stroke="black" fill="none" class="selectable" style=${style}
        d=${`M 0 0 L 0 ${offset}`}></path>
      <path stroke="black" fill="none" class="selectable" style=${style}
        d=${groundSymbolPath(size * 1.5)} transform=${`translate(0,${offset})`}></path>`
  }

  #renderNode(node: SceneNode, pos: Map<number, Point>, size: number) {
    const p = pos.get(node.id)
    if (!p) return nothing
    const style = this.selection.nodes.has(node.id) ? SELECTED_STYLE : NODE_STYLE

    return svg`
      <g data-node=${node.id} transform="translate(${p.x},${p.y})">
        ${node.ground ? this.#renderGround(size, style) : nothing}
        ${this.#renderShape(node.kind, size, style)}
        ${
          node.text
            ? svg`<text y=${0.7 * size + 14} text-anchor="middle" font-size="12px"
                font-family="monospace" fill=${PHASE_FILL}
                style="pointer-events: none; user-select: none;">${node.text}</text>`
            : nothing
        }
        ${
          this.showLabels
            ? svg`<text y=${-0.7 * size - 8} text-anchor="middle" font-size="10px"
                font-family="monospace" fill=${LABEL_FILL}
                style="pointer-events: none; user-select: none;">${node.id}</text>`
            : nothing
        }
        ${
          node.vdata.length > 0
            ? svg`<text y=${-0.7 * size - 14 - 10 * node.vdata.length} text-anchor="middle"
                font-size="8px" font-family="monospace" fill="#c66"
                style="pointer-events: none; user-select: none;">${node.vdata.map(
                  entry => svg`<tspan x="0" dy="1.2em">${entry.join(': ')}</tspan>`,
                )}</text>`
            : nothing
        }
      </g>`
  }

  /** pyzx pins the scalar at a fixed x: 60 / y: 40, which lands off to the
   *  left on any diagram wider than ~120px and sits above the diagram. This
   *  centres it in the strip `layout()` reserves below, in the same monospace
   *  family as the phase and vdata labels. */
  #renderScalar(scene: Scene) {
    if (scene.scalar === '') return nothing
    // No whitespace inside <text>: SVG would render it, off-centring the
    // scalar. The gap after the '×' is the tspan's dx instead.
    return svg`
      <text x=${scene.width / 2} y=${scene.scalarY} text-anchor="middle" font-family="monospace"><tspan fill=${LABEL_FILL}>×</tspan><tspan dx="0.4em">${scene.scalar}</tspan></text>`
  }

  render() {
    const scene = this.scene
    if (!scene || !this.#topology) return nothing
    const pos = this.#positions()
    const pad = 0.4 * scene.scale + scene.nodeSize

    return html`
      <svg width=${scene.width} height=${scene.height} style="max-width: none; max-height: none">
        <g class="boxes" pointer-events="none">
          ${scene.boxes.map(box => {
            const bounds = boxBounds(box, pos, pad)
            const style = BOX_STYLE[box.kind]
            return bounds
              ? svg`<rect
                  rx="4" ry="4"
                  x=${bounds.x} y=${bounds.y}
                  width=${bounds.width} height=${bounds.height}
                  fill=${style.fill} stroke=${style.stroke}
                  stroke-width="1" stroke-dasharray=${style.dash} />`
              : nothing
          })}
        </g>

        <g class="web">
          ${scene.webs.map(
            web => svg`<path
              d=${webPath(web, pos)} stroke=${webColor(web.kind, this.colors)}
              fill="transparent" style="stroke-width: 7px" />`,
          )}
        </g>

        <g class="link">
          ${scene.links.map((link, i) => {
            // `scene.links` is built from `diagram.edges` in order, so the
            // index here is the edge index a selection names.
            const selected = this.selection.edges.has(i)
            return svg`<path
              d=${linkPath(link, pos)}
              stroke=${selected ? SELECTED_STROKE : edgeColor(link.kind, this.colors)}
              fill="transparent" style=${selected ? SELECTED_LINK_STYLE : LINK_STYLE} />`
          })}
        </g>

        <g class="brush" @mousedown=${this.#onBrushDown}>
          <rect class="overlay" x="0" y="0" width=${scene.width} height=${scene.height}
            fill="transparent" />
          ${
            this.#brush
              ? svg`<rect
                  x=${this.#brush.x} y=${this.#brush.y}
                  width=${this.#brush.width} height=${this.#brush.height}
                  fill="rgba(100,140,255,0.15)" stroke="rgba(100,140,255,0.6)"
                  stroke-dasharray="4 3" pointer-events="none" />`
              : nothing
          }
        </g>

        <g class="node" @mousedown=${this.#onNodeDown}>
          ${scene.nodes.map(node => this.#renderNode(node, pos, scene.nodeSize))}
        </g>

        ${this.#renderScalar(scene)}
        ${this.overlay ?? nothing}
      </svg>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zx-viewer': ZxViewerElement
  }
}
