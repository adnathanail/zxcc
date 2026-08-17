// `<zx-diagram>` — the public element. It lays a `DiagramData` out into a
// `Scene`, hands that to whichever painter `view-mode` asks for — `<zx-viewer>`,
// `<zx-hypergraph-viewer>`, or both stacked — and owns everything around the
// drawing: the scroll containers, the presentation properties that mirror
// pyzx's `draw_d3` keyword arguments, the error state, and the attribution.
//
// It also carries the stylesheet for the whole shadow tree, the viewer's SVG
// included, since the viewer renders into the light DOM.

import { css, html, LitElement, nothing, type PropertyValues, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { attributionTemplate, placeAttribution } from './attribution'
import { CANVAS_FILL, COLOR_SCHEMES, type ColorSchemeName } from './colors'
import { ZOOM as HYPERGRAPH_ZOOM, layoutHypergraph } from './hypergraph/layout'
import type { HypergraphScene } from './hypergraph/types'
import { layout } from './layout'
// `@zx-selection` in the template below is `SELECTION_EVENT`, written out
// because a Lit binding's name has to be a literal.
import { EMPTY_SELECTION, type Selection } from './selection'
import type { DiagramData, Scene } from './types'
import './graph/viewer'
import './hypergraph/viewer'

// A plain `{type: Boolean}` attribute can't express "off" for a property that
// defaults to true — absence and `="false"` would both have to mean false.
// This treats an explicit "false" as off and presence/""/"true" as on.
const defaultTrueBoolean = {
  fromAttribute: (value: string | null) => value !== null && value !== 'false',
}

/** Which of the two painters the element runs: the ZX diagram, its hypergraph
 *  dual, or both stacked one above the other. */
export type ViewMode = 'graph' | 'hypergraph' | 'both'

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

  /** Which view to draw: the ZX diagram (`graph`), its hypergraph dual —
   *  wires as dots, spiders as blobs enclosing the dots of their wires —
   *  (`hypergraph`), or `both`, stacked. An unrecognised value draws the
   *  graph, as an unrecognised `color-scheme` falls back to the original. */
  @property({ attribute: 'view-mode' }) viewMode: ViewMode = 'graph'

  /** The laid-out views. Which are non-null follows `viewMode`, so in `both`
   *  they are populated together and two painters are rendered. */
  @state() private scene: Scene | null = null
  @state() private hypergraph: HypergraphScene | null = null
  @state() private error: string | null = null

  /** What is picked out, held here rather than in either painter so that the
   *  two track each other: it is stated in the diagram's own terms — ZX node
   *  ids and edge indices — and each painter draws whatever that means in its
   *  own picture. A painter announces the selection a gesture makes; this is
   *  the only thing that stores one. */
  @state() private selection: Selection = EMPTY_SELECTION

  private onSelection = (e: Event) => {
    this.selection = (e as CustomEvent<Selection>).detail
  }

  // Container background is Bootstrap .bg-light-subtle
  // Attribution background is Bootstrap .bg-secondary-subtle w/ 50% transparency
  static styles = css`
    :host { display: block; }
    .container { overflow: auto; background-color: white; }
    /* In both-view mode the two are separate pictures stacked, each scrolling
       on its own; the gap is what stops them reading as one drawing. */
    .container + .container { margin-top: 0.5rem; }
    zx-viewer, zx-hypergraph-viewer { display: block; }
    .container svg { display: block; background-color: ${unsafeCSS(CANVAS_FILL)}; }
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
    if (changed.has('diagram') || changed.has('scale') || changed.has('viewMode')) {
      this.relayout()
    }
  }

  /** The views being painted, each with the tag of the painter drawing it, in
   *  stack order. Every one carries its own attribution badge, placed against
   *  its own pixel bounds — the badge belongs to the picture, not to the
   *  element, so a copied SVG takes it along whichever of the pair it is. */
  private get painted(): Array<[string, Scene | HypergraphScene]> {
    const views: Array<[string, Scene | HypergraphScene]> = []
    if (this.scene) views.push(['zx-viewer', this.scene])
    if (this.hypergraph) views.push(['zx-hypergraph-viewer', this.hypergraph])
    return views
  }

  /** The palette both painters are handed: an explicit `colors` override wins
   *  over the named scheme, and an unknown scheme name falls back to pyzx's
   *  original. */
  private get palette(): Record<string, string> {
    return this.colors ?? COLOR_SCHEMES[this.colorScheme] ?? COLOR_SCHEMES.original
  }

  private get painters(): LitElement[] {
    return [...this.renderRoot.querySelectorAll<LitElement>('zx-viewer, zx-hypergraph-viewer')]
  }

  private paintersComplete(): Promise<unknown> {
    return Promise.all(this.painters.map(p => p.updateComplete))
  }

  /** A painter updates on its own cycle, so the SVG this element's template
   *  asks for isn't in the DOM until the children have rendered too. */
  protected override async getUpdateComplete(): Promise<boolean> {
    const done = await super.getUpdateComplete()
    await this.paintersComplete()
    return done
  }

  protected async updated() {
    const views = this.painted
    if (!this.placementPending || views.length === 0) return
    const [scene, hypergraph] = [this.scene, this.hypergraph]
    await this.paintersComplete()
    // A relayout during that await leaves us holding views that are no longer
    // painted; whichever update cycle installed the new ones places their
    // badges.
    if (this.scene !== scene || this.hypergraph !== hypergraph) return
    // Each badge is measured against its own painter's box, and the pass only
    // counts as done once every one of them has been placed — one view can be
    // measurable while the other still isn't.
    const placed = views.map(([tag, view]) => {
      const group = this.renderRoot.querySelector<SVGGElement>(`${tag} g.attribution`)
      return group !== null && placeAttribution(group, view.width, view.height)
    })
    if (placed.every(Boolean)) this.placementPending = false
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
    // A fresh layout is a fresh drawing, and the old selection names ids that
    // may not even be in it.
    this.selection = EMPTY_SELECTION
    try {
      // Both views start from the same `layout()`; the hypergraph is derived
      // from that scene rather than laying the diagram out a second time. The
      // two are built into locals first so a hypergraph that can't be
      // converted leaves no half-painted pair behind for the error state.
      if (this.diagram) {
        const scene = layout(this.diagram, { scale: this.scale ?? undefined })
        const hypergraph =
          this.viewMode === 'hypergraph' || this.viewMode === 'both'
            ? layoutHypergraph(this.diagram, scene)
            : null
        // The hypergraph is drawn `ZOOM` times roomier than the diagram it came
        // from, so a stacked pair off one layout would be two different sizes.
        // Laying the graph out again at the zoomed scale is what matches them:
        // every pixel position `layout()` produces is proportional to `scale`,
        // so the graph comes out the same width as the dual and each dot lands
        // under the wire it stands for. Scaling the painted SVG instead would
        // have blown the labels up with it.
        if (this.viewMode === 'graph') this.scene = scene
        else if (this.viewMode === 'both') {
          this.scene = layout(this.diagram, { scale: scene.scale * HYPERGRAPH_ZOOM })
        }
        this.hypergraph = hypergraph
      }
      this.error = null
    } catch (e) {
      this.scene = null
      this.hypergraph = null
      this.error = e instanceof Error ? e.message : String(e)
    }
    this.placementPending = this.painted.length > 0
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
    if (!this.scene && !this.hypergraph) return nothing

    return html`
      ${
        this.scene === null
          ? nothing
          : html`
            <div class="container">
              <zx-viewer
                .scene=${this.scene}
                .colors=${this.palette}
                .showLabels=${this.showLabels}
                .selection=${this.selection}
                @zx-selection=${this.onSelection}
                .overlay=${attributionTemplate(this.scene.width, this.scene.height)}
              ></zx-viewer>
            </div>
          `
      }
      ${
        this.hypergraph === null
          ? nothing
          : html`
            <div class="container">
              <zx-hypergraph-viewer
                .scene=${this.hypergraph}
                .colors=${this.palette}
                .showLabels=${this.showLabels}
                .selection=${this.selection}
                @zx-selection=${this.onSelection}
                .overlay=${attributionTemplate(this.hypergraph.width, this.hypergraph.height)}
              ></zx-hypergraph-viewer>
            </div>
          `
      }
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zx-diagram': ZxDiagramElement
  }
}
