// `<zx-hypergraph-viewer>` — paints a `HypergraphScene`: a dot per ZX edge,
// and a blob around the dots of each ZX node's incident wires.
//
// The second painter alongside `<zx-viewer>`, and internal in the same way: it
// renders into the light DOM so it shares `<zx-diagram>`'s stylesheet and
// leaves the SVG reachable from the host's shadow root.
//
// Blob outlines are derived in `render()` from the dot positions rather than
// stored, so live positions are all that would need to become state. There are
// no interactions yet — dots don't drag.

import { html, LitElement, nothing, type SVGTemplateResult, svg } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { edgeColor, nodeColor, ORIGINAL_COLORS } from '../colors'
import type { Point } from '../curves'
import { blobLabelAnchor, blobOutline } from './geometry'
import type { HypergraphBlob, HypergraphScene } from './types'

/** A blob is filled with its node's own palette colour and outlined in black,
 *  the way `<zx-viewer>` paints the node itself. The fill is part-transparent
 *  because the blobs overlap — every dot that isn't a boundary leg is shared by
 *  two of them — so an overlap reads as the two colours over each other. */
const BLOB_FILL_OPACITY = '0.4'
const BLOB_STROKE = 'black'
const BLOB_STROKE_WIDTH = '1.5'
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

  protected createRenderRoot() {
    return this
  }

  #renderBlob(scene: HypergraphScene, blob: HypergraphBlob, pos: Map<string, Point>) {
    const anchor = this.showLabels ? blobLabelAnchor(blob, pos, scene.blobRadius) : null
    return svg`
      <g data-hyperedge=${blob.id}>
        <path d=${blobOutline(blob, pos, scene.blobRadius)}
          fill=${nodeColor(blob.kind, this.colors)} fill-opacity=${BLOB_FILL_OPACITY}
          stroke=${BLOB_STROKE} stroke-width=${BLOB_STROKE_WIDTH}
          stroke-linejoin="round" />
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
    const pos = new Map<string, Point>(scene.dots.map(d => [d.id, { x: d.x, y: d.y }]))

    return html`
      <svg width=${scene.width} height=${scene.height} style="max-width: none; max-height: none">
        <g class="blob">${scene.blobs.map(blob => this.#renderBlob(scene, blob, pos))}</g>

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
