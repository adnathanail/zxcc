// `<zx-graph>` — the public element for a ZX diagram drawn as itself: spiders,
// boxes and the wires between them.
//
// It lays a `DiagramData` out into a `Scene` and hands that to `<zx-viewer>`.
// Everything a public element does around a painter is `ZxViewerHost`; what is
// here is what belongs to this input — the diagram, the scale it is drawn at,
// and the one scene it paints.

import { html, nothing, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { attributionTemplate } from './attribution'
import { layout } from './layout'
import type { DiagramData, Scene } from './types'
import { type PaintedView, ZxViewerHost } from './viewerHost'
import './graph/viewer'

@customElement('zx-graph')
export class ZxGraphElement extends ZxViewerHost {
  /** The diagram to draw. Replace the object to change it — layout runs on a
   *  new identity, so mutating the one already assigned paints nothing new.
   *  {@link refresh} is the escape hatch if you must mutate in place. */
  @property({ attribute: false }) diagram: DiagramData | null = null

  /** Pixels per row/qubit. Null, or anything but a positive number, derives
   *  it from the diagram's extent. */
  @property({ type: Number }) scale: number | null = null

  @state() private scene: Scene | null = null

  protected get painted(): PaintedView[] {
    return this.scene ? [['zx-viewer', this.scene]] : []
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('diagram') || changed.has('scale')) this.relayout()
  }

  protected clear() {
    this.scene = null
  }

  protected build() {
    this.scene = this.diagram ? layout(this.diagram, { scale: this.scale ?? undefined }) : null
  }

  render() {
    if (this.error !== null) return this.errorTemplate(this.error)
    if (!this.scene) return nothing
    // `@zx-selection` is `SELECTION_EVENT`, written out because a Lit binding's
    // name has to be a literal.
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
