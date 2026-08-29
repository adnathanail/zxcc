// `<zx-diagram>` — the public element for a ZX diagram. It lays a `DiagramData`
// out into a `Scene`, hands that to whichever painter `view-mode` asks for —
// `<zx-viewer>`, `<zx-hypergraph-viewer>`, or both, stacked or side by side —
// and owns the scroll containers they sit in.
//
// Everything a public element does around a painter — the presentation
// properties, the palette, the error state, the shared selection, the
// attribution badge, and the stylesheet the light-DOM painters are styled by —
// is `ZxViewerHost`, which `<zx-hypergraph>` is built on too. What is here is
// what belongs to *this* input: the diagram, the view mode, and the fact that
// drawing both views means laying the diagram out twice.

import { css, html, nothing, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { attributionTemplate } from './attribution'
import { VIEW_MODES, type ViewMode } from './constants'
import {
  ZOOM as HYPERGRAPH_ZOOM,
  type HypergraphLayoutOptions,
  layoutHypergraph,
} from './hypergraph/layout'
import type { HypergraphScene } from './hypergraph/types'
import { layout } from './layout'
// `@zx-selection` in the template below is `SELECTION_EVENT`, written out
// because a Lit binding's name has to be a literal.
import { EMPTY_SELECTION } from './selection'
import type { DiagramData, Scene } from './types'
import { type PaintedView, ZxViewerHost } from './viewerHost'
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
export class ZxDiagramElement extends ZxViewerHost {
  /** The diagram to draw. Replace the object to change it — layout runs on a
   *  new identity, so mutating the one already assigned paints nothing new.
   *  {@link refresh} is the escape hatch if you must mutate in place. */
  @property({ attribute: false }) diagram: DiagramData | null = null

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

  /** The pair's own layout, on top of the host's stylesheet: everything else
   *  the shadow tree needs is the same for either element. */
  static styles = [
    ZxViewerHost.styles,
    css`
      /* In a both-view mode the two are separate pictures, each scrolling on
         its own; the gap is what stops them reading as one drawing. The view
         mode picks which way the pair runs, the only thing that differs between
         the two. */
      .views { display: flex; gap: 0.5rem; }
      .views.vertical { flex-direction: column; }
      .views.horizontal { flex-direction: row; align-items: flex-start; }
      /* Side by side the two split the width evenly rather than sizing to their
         drawings, so neither is squeezed out by a wide neighbour; the zero
         min-width is what makes a picture wider than its half scroll instead of
         stretching the box. */
      .views.horizontal > .container { flex: 1 1 0; min-width: 0; }
    `,
  ]

  protected get painted(): PaintedView[] {
    const views: PaintedView[] = []
    if (this.scene) views.push(['zx-viewer', this.scene])
    if (this.hypergraph) views.push(['zx-hypergraph-viewer', this.hypergraph])
    return views
  }

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

  protected relayout() {
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
    if (this.error !== null) return this.errorTemplate(this.error)
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
