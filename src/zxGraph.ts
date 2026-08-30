// `<zx-graph>` — the public element for a ZX diagram drawn as itself: spiders,
// boxes and the wires between them.
//
// It lays a `DiagramData` out into a `Scene` and hands that to `<zx-viewer>`,
// and that is the whole of it. `<zx-hypergraph>` is the same shape for the dual,
// and `<zx-diagram>` is the element that takes a diagram and mounts one or both
// of them — which is what `view-mode` picks between. Use this one when the
// picture you want is the diagram and only the diagram; nothing here knows the
// dual exists.
//
// Everything a public element does around a painter — the presentation
// properties, the palette, the error state, the selection, the attribution
// badge, and the stylesheet the light-DOM painter is styled by — is
// `ZxViewerHost`. What is here is what belongs to *this* input: the diagram, the
// scale it is drawn at, and the one scene it paints.

import { html, nothing, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { attributionTemplate } from './attribution'
import { layout } from './layout'
// `@zx-selection` in the template below is `SELECTION_EVENT`, written out
// because a Lit binding's name has to be a literal.
import { EMPTY_SELECTION } from './selection'
import type { DiagramData, Scene } from './types'
import { type PaintedView, ZxViewerHost } from './viewerHost'
import './graph/viewer'

@customElement('zx-graph')
export class ZxGraphElement extends ZxViewerHost {
  /** The diagram to draw. Replace the object to change it — layout runs on a
   *  new identity, so mutating the one already assigned paints nothing new.
   *  {@link refresh} is the escape hatch if you must mutate in place. */
  @property({ attribute: false }) diagram: DiagramData | null = null

  /** Pixels per row/qubit. Null derives it from the diagram's extent. */
  @property({ type: Number }) scale: number | null = null

  @state() private scene: Scene | null = null

  protected get painted(): PaintedView[] {
    return this.scene ? [['zx-viewer', this.scene]] : []
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('diagram') || changed.has('scale')) this.relayout()
  }

  /**
   * Lay the current `diagram` out again, for consumers that mutate it in place
   * rather than replacing it.
   *
   * This produces a fresh scene, which resets the drawing to it: dragged nodes
   * return to their laid-out positions and the selection is cleared. That is
   * why it isn't run on every render — replacing `diagram` is the cheaper and
   * more predictable way to change the picture.
   */
  refresh() {
    this.relayout()
  }

  protected relayout() {
    this.scene = null
    // A fresh layout is a fresh drawing, and the old selection names ids that
    // may not even be in it.
    this.selection = EMPTY_SELECTION
    try {
      this.scene = this.diagram ? layout(this.diagram, { scale: this.scale ?? undefined }) : null
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
        <zx-viewer
          .scene=${this.scene}
          .colors=${this.palette}
          .edgeColors=${this.edgeColors}
          .showLabels=${this.showLabels}
          .selection=${this.selection}
          @zx-selection=${this.onSelection}
          .overlay=${attributionTemplate(this.scene.width, this.scene.height)}
        ></zx-viewer>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zx-graph': ZxGraphElement
  }
}
