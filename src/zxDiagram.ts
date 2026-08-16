// `<zx-diagram>` — the public element. It lays a `DiagramData` out into a
// `Scene`, hands that to `<zx-viewer>` to paint, and owns everything around
// the drawing: the scroll container, the presentation properties that mirror
// pyzx's `draw_d3` keyword arguments, the error state, and the attribution.
//
// It also carries the stylesheet for the whole shadow tree, the viewer's SVG
// included, since the viewer renders into the light DOM.

import { css, html, LitElement, nothing, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { attributionTemplate, placeAttribution } from './attribution'
import { COLOR_SCHEMES, type ColorSchemeName } from './colors'
import { layoutHypergraph } from './hypergraph/layout'
import type { HypergraphScene } from './hypergraph/types'
import { layout } from './layout'
import type { DiagramData, Scene } from './types'
import './graph/viewer'
import './hypergraph/viewer'

// A plain `{type: Boolean}` attribute can't express "off" for a property that
// defaults to true — absence and `="false"` would both have to mean false.
// This treats an explicit "false" as off and presence/""/"true" as on.
const defaultTrueBoolean = {
  fromAttribute: (value: string | null) => value !== null && value !== 'false',
}

@customElement('zx-diagram')
export class ZxDiagramElement extends LitElement {
  /** The diagram to draw. Replace the object to change it — layout runs on a
   *  new identity, so mutating the one already assigned paints nothing new.
   *  {@link refresh} is the escape hatch if you must mutate in place. */
  @property({ attribute: false }) diagram: DiagramData | null = null

  /** Draw each node's id above it (pyzx's `draw_d3(labels=...)`). Defaults on,
   *  unlike pyzx — turning it off is a visual change for existing consumers. */
  @property({ attribute: 'show-labels', converter: defaultTrueBoolean })
  showLabels = true

  /** Named pyzx palette. Ignored when `colors` is set. */
  @property({ attribute: 'color-scheme' }) colorScheme: ColorSchemeName = 'original'

  /** Full palette override, keyed as in `pyzx.utils.original_colors`. */
  @property({ attribute: false }) colors: Record<string, string> | null = null

  /** Pixels per row/qubit. Null derives it from the diagram's extent. */
  @property({ type: Number }) scale: number | null = null

  /** Draw the diagram's hypergraph dual — wires as dots, spiders as blobs
   *  enclosing the dots of their wires — instead of the ZX diagram. */
  @property({ type: Boolean, attribute: 'view-as-hypergraph' }) viewAsHypergraph = false

  @state() private scene: Scene | null = null
  /** The laid-out hypergraph, when `viewAsHypergraph` is on. Mutually
   *  exclusive with `scene`: only one of the two views is built per update. */
  @state() private hypergraph: HypergraphScene | null = null
  @state() private error: string | null = null

  // Container background is Bootstrap .bg-light-subtle
  // Attribution background is Bootstrap .bg-secondary-subtle w/ 50% transparency
  static styles = css`
    :host { display: block; }
    .container { overflow: auto; background-color: white; }
    zx-viewer, zx-hypergraph-viewer { display: block; }
    .container svg { display: block; background-color: rgb(252, 252, 253); }
    .error { font-family: monospace; }
    .error pre { color: red; white-space: pre-wrap; word-break: break-word; margin: 0; }
    .error button { cursor: pointer; }
    .attribution text {
      font: 11px system-ui, sans-serif;
      fill: #333;
      user-select: none;
    }
    .attribution rect { fill: rgba(226, 227, 229, 0.5); }
    .attribution a text, .attribution a tspan { fill: #0366d6; }
    .attribution a:hover tspan { text-decoration: underline; }
  `

  /** The attribution chip can only be sized once the text has been laid out,
   *  so placement waits for `updated()` — and only when the diagram box moved,
   *  since `getBBox()` forces a reflow. It stays pending until a measurement
   *  succeeds: the text measures zero-wide while the element is inside a
   *  hidden ancestor, and a later render is the only chance to catch it once
   *  it is on screen. */
  private placementPending = false

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('diagram') || changed.has('scale') || changed.has('viewAsHypergraph')) {
      this.relayout()
    }
  }

  /** Whichever painter is in play. Both views are laid out to pixel bounds,
   *  which is all the attribution needs to place itself. */
  private get painted(): Scene | HypergraphScene | null {
    return this.scene ?? this.hypergraph
  }

  /** The palette both painters are handed: an explicit `colors` override wins
   *  over the named scheme, and an unknown scheme name falls back to pyzx's
   *  original. */
  private get palette(): Record<string, string> {
    return this.colors ?? COLOR_SCHEMES[this.colorScheme] ?? COLOR_SCHEMES.original
  }

  private get painter(): LitElement | null {
    return this.renderRoot.querySelector<LitElement>('zx-viewer, zx-hypergraph-viewer')
  }

  /** The painter updates on its own cycle, so the SVG this element's template
   *  asks for isn't in the DOM until the child has rendered too. */
  protected override async getUpdateComplete(): Promise<boolean> {
    const done = await super.getUpdateComplete()
    await this.painter?.updateComplete
    return done
  }

  protected async updated() {
    const scene = this.painted
    if (!this.placementPending || !scene) return
    await this.painter?.updateComplete
    // A relayout during that await leaves us holding a scene that is no longer
    // painted; whichever update cycle installed the new one places its badge.
    if (this.painted !== scene) return
    const group = this.renderRoot.querySelector<SVGGElement>('g.attribution')
    if (group && placeAttribution(group, scene.width, scene.height)) {
      this.placementPending = false
    }
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
    this.requestUpdate()
  }

  private relayout() {
    this.scene = null
    this.hypergraph = null
    try {
      // Both views start from the same `layout()`; the hypergraph is derived
      // from that scene rather than laying the diagram out a second time.
      if (this.diagram) {
        const scene = layout(this.diagram, { scale: this.scale ?? undefined })
        if (this.viewAsHypergraph) this.hypergraph = layoutHypergraph(this.diagram, scene)
        else this.scene = scene
      }
      this.error = null
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e)
    }
    this.placementPending = this.painted !== null
  }

  render() {
    if (this.error !== null) {
      return html`
        <div class="error">
          <pre>${this.error}</pre>
          <button type="button" @click=${() => this.relayout()}>Retry</button>
        </div>
      `
    }
    if (this.hypergraph !== null) {
      return html`
        <div class="container">
          <zx-hypergraph-viewer
            .scene=${this.hypergraph}
            .colors=${this.palette}
            .showLabels=${this.showLabels}
            .overlay=${attributionTemplate(this.hypergraph.width, this.hypergraph.height)}
          ></zx-hypergraph-viewer>
        </div>
      `
    }
    if (!this.scene) return nothing

    return html`
      <div class="container">
        <zx-viewer
          .scene=${this.scene}
          .colors=${this.palette}
          .showLabels=${this.showLabels}
          .overlay=${attributionTemplate(this.scene.width, this.scene.height)}
        ></zx-viewer>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zx-diagram': ZxDiagramElement
  }
}
