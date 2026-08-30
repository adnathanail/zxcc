// `<zx-hypergraph>` — the public element for a hypergraph given directly, as
// opposed to one derived from a ZX diagram.
//
// `<zx-diagram>` takes a `DiagramData`, lays it out, and can draw the dual of
// what it laid out. That route puts every dot on the midpoint of the wire it
// stands for, which is what makes the two pictures line up — and is also the
// whole of what it will do. This element is the other way in: the caller says
// what the hypergraph is and which grid square each dot goes in, and the same
// painter draws it. Nothing here works out where anything goes; `manualScene`
// only scales the given grid to pixels.
//
// It is the second host built on `ZxViewerHost`, and holds only what is its
// own: the input, the scale that grid is drawn at, and the one scene it
// paints.

import { html, nothing, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { attributionTemplate } from './attribution'
import { manualScene } from './hypergraph/manual'
import type { HypergraphInput, HypergraphScene } from './hypergraph/types'
// `@zx-selection` in the template below is `SELECTION_EVENT`, written out
// because a Lit binding's name has to be a literal.
import { EMPTY_SELECTION } from './selection'
import { type PaintedView, ZxViewerHost } from './viewerHost'
import './hypergraph/viewer'

/** The ZX layout's unit, as `<zx-diagram>` derives one from a diagram's extent.
 *  There is no diagram here to derive one from, so this is what the grid is
 *  drawn at until `scale` says otherwise, and it is the middle of the 20–50
 *  band `layout()` clamps its derived scale to. */
const DEFAULT_SCALE = 35

@customElement('zx-hypergraph')
export class ZxHypergraphElement extends ZxViewerHost {
  /** The hypergraph to draw. Replace the object to change it — the scene is
   *  measured on a new identity, so mutating the one already assigned paints
   *  nothing new. {@link refresh} is the escape hatch if you must mutate in
   *  place. */
  @property({ attribute: false }) hypergraph: HypergraphInput | null = null

  /** The unit the grid the input is written on is drawn at — the same number
   *  `<zx-diagram>`'s `scale` means, doing the same job. It sets how far apart
   *  the dots are drawn (two `scale`s to a column, so the blobs have room) as
   *  well as how big one is and how far a blob's outline stands off the dots it
   *  holds, so the whole drawing grows and shrinks with it. */
  @property({ type: Number }) scale: number = DEFAULT_SCALE

  @state() private scene: HypergraphScene | null = null

  protected get painted(): PaintedView[] {
    return this.scene ? [['zx-hypergraph-viewer', this.scene]] : []
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('hypergraph') || changed.has('scale')) this.relayout()
  }

  /**
   * Measure the current `hypergraph` again, for consumers that mutate it in
   * place rather than replacing it.
   *
   * This produces a fresh scene, which resets the drawing to it: dragged dots
   * return to the positions the input gave them and the selection is cleared.
   */
  refresh() {
    this.relayout()
  }

  protected relayout() {
    this.scene = null
    // A fresh scene is a fresh drawing, and the old selection names wires and
    // hyperedges that may not even be in it.
    this.selection = EMPTY_SELECTION
    try {
      this.scene = this.hypergraph ? manualScene(this.hypergraph, this.scale) : null
      this.error = null
    } catch (e) {
      this.scene = null
      this.error = e instanceof Error ? e.message : String(e)
    }
    this.placementPending = this.painted.length > 0
  }

  render() {
    if (this.error !== null) return this.errorTemplate(this.error)
    if (!this.scene) return nothing
    return html`
      <div class="container">
        <zx-hypergraph-viewer
          .scene=${this.scene}
          .colors=${this.palette}
          .edgeColors=${this.edgeColors}
          .showLabels=${this.showLabels}
          .selection=${this.selection}
          @zx-selection=${this.onSelection}
          .overlay=${attributionTemplate(this.scene.width, this.scene.height)}
        ></zx-hypergraph-viewer>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zx-hypergraph': ZxHypergraphElement
  }
}
