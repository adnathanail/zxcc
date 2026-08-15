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
import { layout } from './layout'
import type { DiagramData, Scene } from './types'
import './zxViewer'

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

  @state() private scene: Scene | null = null
  @state() private error: string | null = null

  // Container background is Bootstrap .bg-light-subtle
  // Attribution background is Bootstrap .bg-secondary-subtle w/ 50% transparency
  static styles = css`
    :host { display: block; }
    .container { overflow: auto; background-color: white; }
    zx-viewer { display: block; }
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
    if (changed.has('diagram') || changed.has('scale')) this.relayout()
  }

  /** `<zx-viewer>` updates on its own cycle, so the SVG this element's
   *  template asks for isn't in the DOM until the child has rendered too. */
  protected override async getUpdateComplete(): Promise<boolean> {
    const done = await super.getUpdateComplete()
    await this.renderRoot.querySelector('zx-viewer')?.updateComplete
    return done
  }

  protected async updated() {
    const scene = this.scene
    if (!this.placementPending || !scene) return
    await this.renderRoot.querySelector('zx-viewer')?.updateComplete
    // A relayout during that await leaves us holding a scene that is no longer
    // painted; whichever update cycle installed the new one places its badge.
    if (this.scene !== scene) return
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
    try {
      this.scene = this.diagram ? layout(this.diagram, { scale: this.scale ?? undefined }) : null
      this.error = null
    } catch (e) {
      this.scene = null
      this.error = e instanceof Error ? e.message : String(e)
    }
    this.placementPending = this.scene !== null
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
    if (!this.scene) return nothing

    return html`
      <div class="container">
        <zx-viewer
          .scene=${this.scene}
          .colors=${this.colors ?? COLOR_SCHEMES[this.colorScheme] ?? COLOR_SCHEMES.original}
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
