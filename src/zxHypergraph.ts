// `<zx-hypergraph>` — the public element for a hypergraph: the dual picture,
// where wires become dots and spiders become blobs.
//
// Nothing here works out where anything goes. The input says what the
// hypergraph is *and* where each dot goes, and `hypergraphScene` measures it
// into pixels. That is what lets the same element serve both ways of arriving
// at a hypergraph: a caller writing one out by hand puts every dot in a grid
// square, and `<zx-diagram>` mounts one of these for its dual, having already
// worked out every position and handed them over in pixels.

import { html, nothing, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { attributionTemplate } from './attribution'
import { hypergraphScene } from './hypergraph/scene'
import type { HypergraphInput, HypergraphScene } from './hypergraph/types'
import { type PaintedView, ZxViewerHost } from './viewerHost'
import './hypergraph/viewer'

/** The scale the grid is drawn at until `scale` says otherwise: the middle of
 *  the 20–50 band `layout()` clamps a derived scale to. There is no diagram
 *  here to derive one from. */
const DEFAULT_SCALE = 35

@customElement('zx-hypergraph')
export class ZxHypergraphElement extends ZxViewerHost {
  /** The hypergraph to draw, and where to draw it — see {@link HypergraphInput}.
   *  Replace the object to change it: the scene is measured on a new identity,
   *  so mutating the one already assigned paints nothing new. {@link refresh}
   *  is the escape hatch if you must mutate in place. */
  @property({ attribute: false }) hypergraph: HypergraphInput | null = null

  /** The unit the drawing is measured in — the same number `<zx-diagram>`'s
   *  `scale` means. It sets how big a dot is drawn and how far a blob's outline
   *  stands off the dots it holds.
   *
   *  For an input written on the grid it also sets how far apart the dots are
   *  (two `scale`s to a column, so the blobs have room), so the whole drawing
   *  grows and shrinks with it. For one written in pixels the positions are
   *  already fixed and this changes the weights alone — raising it there grows
   *  the dots without moving them. */
  @property({ type: Number }) scale: number = DEFAULT_SCALE

  @state() private scene: HypergraphScene | null = null

  protected get painted(): PaintedView[] {
    return this.scene ? [['zx-hypergraph-viewer', this.scene]] : []
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('hypergraph') || changed.has('scale')) this.relayout()
  }

  protected clear() {
    this.scene = null
  }

  protected build() {
    this.scene = this.hypergraph ? hypergraphScene(this.hypergraph, this.scale) : null
  }

  render() {
    if (this.error !== null) return this.errorTemplate(this.error)
    if (!this.scene) return nothing
    // `@zx-selection` is `SELECTION_EVENT`, written out because a Lit binding's
    // name has to be a literal.
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
