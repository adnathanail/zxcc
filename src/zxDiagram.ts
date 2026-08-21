// `<zx-diagram>` — the public element. It lays a `DiagramData` out into a
// `Scene`, hands that to whichever painter `view-mode` asks for — `<zx-viewer>`,
// `<zx-hypergraph-viewer>`, or both, stacked or side by side — and owns everything around the
// drawing: the scroll containers, the presentation properties that mirror
// pyzx's `draw_d3` keyword arguments, the error state, and the attribution.
//
// It also carries the stylesheet for the whole shadow tree, the viewer's SVG
// included, since the viewer renders into the light DOM.

import { css, html, LitElement, nothing, type PropertyValues, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { attributionTemplate, placeAttribution } from './attribution'
import type { EdgeColors } from './colors'
import {
  CANVAS_FILL,
  COLOR_SCHEMES,
  type ColorSchemeName,
  VIEW_MODES,
  type ViewMode,
} from './constants'
import {
  ZOOM as HYPERGRAPH_ZOOM,
  type HypergraphLayoutOptions,
  layoutHypergraph,
} from './hypergraph/layout'
import type { HypergraphScene } from './hypergraph/types'
import { layout } from './layout'
// `@zx-selection` in the template below is `SELECTION_EVENT`, written out
// because a Lit binding's name has to be a literal.
import { EMPTY_SELECTION, type Selection } from './selection'
import type { DiagramData, Scene } from './types'
import './graph/viewer'
import './hypergraph/viewer'

/** `view-mode` is a plain string attribute, so the value that arrives is
 *  whatever was typed — `ViewMode` says nothing about it at runtime. */
function isViewMode(mode: string): mode is ViewMode {
  return (VIEW_MODES as readonly string[]).includes(mode)
}

/** Whether a mode runs both painters — the one question most of this file asks
 *  of `viewMode`, since the arrangement only matters at the point it is drawn. */
const isBoth = (mode: ViewMode) => mode === 'both-vertical' || mode === 'both-horizontal'

@customElement('zx-diagram')
export class ZxDiagramElement extends LitElement {
  /** The diagram to draw. Replace the object to change it — layout runs on a
   *  new identity, so mutating the one already assigned paints nothing new.
   *  {@link refresh} is the escape hatch if you must mutate in place. */
  @property({ attribute: false }) diagram: DiagramData | null = null

  /** Draw each node's id above it (pyzx's `draw_d3(labels=...)`). Off by
   *  default, as in pyzx: an id is a fact about the data structure rather than
   *  about the diagram, so it is worth asking for rather than assuming. A bare
   *  `show-labels` attribute turns it on. */
  @property({ attribute: 'show-labels', type: Boolean })
  showLabels = false

  /** Named pyzx palette. Ignored when `colors` is set. */
  @property({ attribute: 'color-scheme' }) colorScheme: ColorSchemeName = 'original'

  /** Full palette override, keyed as in `pyzx.utils.original_colors`. */
  @property({ attribute: false }) colors: Record<string, string> | null = null

  /** Wire colours by edge kind — `{ hadamard: '#f60', control: 'grey' }`. Wins
   *  over both `colors` and `color-scheme`, and only for the kinds named, so
   *  recolouring one kind of wire doesn't mean restating a palette. Keyed by
   *  `DiagramEdge['kind']` rather than by pyzx's `Hedge`/`Xedge`/`edge` entry
   *  names, which is what lets a diagram invent kinds: any string is a kind,
   *  and this is where it gets a colour. One with no colour here draws like a
   *  plain wire. */
  @property({ attribute: false }) edgeColors: EdgeColors | null = null

  /** Pixels per row/qubit. Null derives it from the diagram's extent. */
  @property({ type: Number }) scale: number | null = null

  /** Which view to draw: ZX diagram (`graph`), hypergraph dual (`hypergraph`),
   *  or both (`both-vertical` / `both-horizontal`).
   *  Throws if given invalid value. */
  @property({ attribute: 'view-mode' }) viewMode: ViewMode = 'graph'

  /** Drop (single node) i/o blobs in the hypergraph view
   *    see {@link HypergraphLayoutOptions.boundaryBlobs}
   *  No effect in `graph` mode. */
  @property({ attribute: 'disable-io-blobs-in-hypergraph', type: Boolean })
  disableIOBlobsInHypergraph = false

  /** The laid-out views. Which are non-null follows `viewMode`, so in either
   *  `both` mode they are populated together and two painters are rendered. */
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
    /* In a both-view mode the two are separate pictures, each scrolling on its
       own; the gap is what stops them reading as one drawing. The view mode
       picks which way the pair runs, the only thing that differs between the
       two. */
    .views { display: flex; gap: 0.5rem; }
    .views.vertical { flex-direction: column; }
    .views.horizontal { flex-direction: row; align-items: flex-start; }
    /* Side by side the two split the width evenly rather than sizing to their
       drawings, so neither is squeezed out by a wide neighbour; the zero
       min-width is what makes a picture wider than its half scroll instead of
       stretching the box. */
    .views.horizontal > .container { flex: 1 1 0; min-width: 0; }
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
    if (
      changed.has('diagram') ||
      changed.has('scale') ||
      changed.has('viewMode') ||
      changed.has('disableIOBlobsInHypergraph')
    ) {
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
   *  original. `edgeColors` rides alongside rather than being folded in — a
   *  kind of your own has no pyzx entry to fold into. */
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
   *
   * A repaint doesn't have to be asked for: everything `relayout()` writes is
   * `@state`, so producing a scene requests the update itself.
   */
  refresh() {
    this.relayout()
  }

  private relayout() {
    this.scene = null
    this.hypergraph = null
    // A fresh layout is a fresh drawing, and the old selection names ids that
    // may not even be in it.
    this.selection = EMPTY_SELECTION
    try {
      // Check if viewMode is valid
      if (!isViewMode(this.viewMode)) {
        throw new Error(
          `Unknown view-mode '${this.viewMode}'. Expected one of: ${VIEW_MODES.join(', ')}.`,
        )
      }
      // Both views start from the same `layout()`; the hypergraph is derived
      // from that scene rather than laying the diagram out a second time. The
      // two are built into locals first so a hypergraph that can't be
      // converted leaves no half-painted pair behind for the error state.
      if (this.diagram) {
        const scene = layout(this.diagram, { scale: this.scale ?? undefined })
        const both = isBoth(this.viewMode)
        const hypergraph =
          this.viewMode === 'hypergraph' || both
            ? layoutHypergraph(this.diagram, scene, {
                boundaryBlobs: !this.disableIOBlobsInHypergraph,
              })
            : null
        // Render graph scene (unless only rendering hypergraph)
        if (this.viewMode !== 'hypergraph') {
          // If rendering graph and hypergraph, scale graph scene to match hypergraph's larger default size
          this.scene = both ? layout(this.diagram, { scale: scene.scale * HYPERGRAPH_ZOOM }) : scene
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

    // Only `both-horizontal` runs the pair across; every other mode stacks,
    // which for a lone painter is the same box either way.
    const direction = this.viewMode === 'both-horizontal' ? 'horizontal' : 'vertical'
    return html`
      <div class="views ${direction}">
      ${
        this.scene === null
          ? nothing
          : html`
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
      ${
        this.hypergraph === null
          ? nothing
          : html`
            <div class="container">
              <zx-hypergraph-viewer
                .scene=${this.hypergraph}
                .colors=${this.palette}
                .edgeColors=${this.edgeColors}
                .showLabels=${this.showLabels}
                .selection=${this.selection}
                @zx-selection=${this.onSelection}
                .overlay=${attributionTemplate(this.hypergraph.width, this.hypergraph.height)}
              ></zx-hypergraph-viewer>
            </div>
          `
      }
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zx-diagram': ZxDiagramElement
  }
}
