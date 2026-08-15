// `<zx-hypergraph-viewer>` — paints a `HypergraphScene`: a dot per ZX edge,
// and a blob around the dots of each ZX node's incident wires.
//
// The second painter alongside `<zx-viewer>`, and internal in the same way: it
// renders into the light DOM so it shares `<zx-diagram>`'s stylesheet and
// leaves the SVG reachable from the host's shadow root.
//
// Blob outlines are derived in `render()` from the dot positions rather than
// stored, so live positions are all that would need to become state. The only
// interaction state is the selection; dots don't drag yet.

import { html, LitElement, nothing, type PropertyValues, type SVGTemplateResult, svg } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { edgeColor, nodeColor, ORIGINAL_COLORS } from '../colors'
import type { Point } from '../curves'
import { blobContains, blobLabelAnchor, blobOutline } from './geometry'
import type { HypergraphBlob, HypergraphScene } from './types'

/** A blob is filled with its node's own palette colour and outlined in black,
 *  the way `<zx-viewer>` paints the node itself. The fill is part-transparent
 *  because the blobs overlap — every dot that isn't a boundary leg is shared by
 *  two of them — so an overlap reads as the two colours over each other. */
const BLOB_FILL_OPACITY = '0.4'
const BLOB_STYLE = 'stroke-width: 1.5px; stroke: black'
/** The blue a selected node gets in `<zx-viewer>`, so a selection looks the
 *  same whichever view you are in. */
const SELECTED_STYLE = 'stroke-width: 2px; stroke: #00f'
const LABEL_FILL = '#555'

@customElement('zx-hypergraph-viewer')
export class ZxHypergraphViewerElement extends LitElement {
  @property({ attribute: false }) scene: HypergraphScene | null = null
  /** Palette to paint with, as `<zx-viewer>` takes. */
  @property({ attribute: false }) colors: Record<string, string> = ORIGINAL_COLORS
  /** Draw each dot's wire id and each blob's label. */
  @property({ attribute: false }) showLabels = true
  /** Extra SVG painted on top, in the scene's coordinate space. */
  @property({ attribute: false }) overlay: SVGTemplateResult | null = null

  /** Ids of the blobs under the last click. A plain field paired with an
   *  explicit `requestUpdate()`, as in `<zx-viewer>`. */
  #selected = new Set<string>()

  protected createRenderRoot() {
    return this
  }

  protected willUpdate(changed: PropertyValues<this>) {
    // A fresh scene is a fresh drawing: the old ids may not even exist in it.
    if (changed.has('scene')) this.#selected = new Set()
  }

  #positions(): Map<string, Point> {
    return new Map(this.scene?.dots.map(d => [d.id, { x: d.x, y: d.y }]) ?? [])
  }

  /**
   * Select every blob the pointer is inside, not just the topmost one — the
   * blobs overlap by construction, since a wire between two spiders is a dot
   * both of them enclose, and seeing which ones share a spot is the point.
   * A click on bare canvas selects nothing.
   */
  #onDown = (e: MouseEvent) => {
    const scene = this.scene
    if (!scene || e.button !== 0) return
    const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    const point = { x: e.clientX - box.left, y: e.clientY - box.top }
    const pos = this.#positions()
    this.#selected = new Set(
      scene.blobs
        .filter(blob => blobContains(blob, pos, scene.blobRadius, point))
        .map(blob => blob.id),
    )
    this.requestUpdate()
  }

  #renderBlob(scene: HypergraphScene, blob: HypergraphBlob, pos: Map<string, Point>) {
    const anchor = this.showLabels ? blobLabelAnchor(blob, pos, scene.blobRadius) : null
    const selected = this.#selected.has(blob.id)
    return svg`
      <g data-hyperedge=${blob.id}>
        <path d=${blobOutline(blob, pos, scene.blobRadius)}
          fill=${nodeColor(blob.kind, this.colors)} fill-opacity=${BLOB_FILL_OPACITY}
          stroke-linejoin="round" style=${selected ? SELECTED_STYLE : BLOB_STYLE} />
        ${
          anchor
            ? svg`<text x=${anchor.x} y=${anchor.y} text-anchor="middle" font-size="11px"
                font-family="monospace" fill=${LABEL_FILL}
                style="pointer-events: none; user-select: none;">${blob.label}</text>`
            : nothing
        }
      </g>`
  }

  render() {
    const scene = this.scene
    if (!scene) return nothing
    const pos = this.#positions()
    // Selected blobs paint last so their outline isn't buried under a
    // neighbour's fill — with this much overlap that is the difference
    // between seeing the highlighted shape and guessing at it.
    const blobs = [...scene.blobs].sort(
      (a, b) => Number(this.#selected.has(a.id)) - Number(this.#selected.has(b.id)),
    )

    return html`
      <svg width=${scene.width} height=${scene.height}
        style="max-width: none; max-height: none" @mousedown=${this.#onDown}>
        <g class="blob">${blobs.map(blob => this.#renderBlob(scene, blob, pos))}</g>

        <g class="dot">
          ${scene.dots.map(
            dot => svg`
              <g data-wire=${dot.id} transform="translate(${dot.x},${dot.y})">
                <circle r=${scene.dotSize} fill=${edgeColor(dot.kind, this.colors)} />
                ${
                  this.showLabels
                    ? svg`<text y=${scene.blobRadius + 11} text-anchor="middle" font-size="10px"
                        font-family="monospace" fill="#999"
                        style="pointer-events: none; user-select: none;">${dot.id}</text>`
                    : nothing
                }
              </g>`,
          )}
        </g>

        ${this.overlay ?? nothing}
      </svg>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zx-hypergraph-viewer': ZxHypergraphViewerElement
  }
}
