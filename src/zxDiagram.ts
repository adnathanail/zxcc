// `<zx-diagram>` — the public element for a ZX diagram, and the only file that
// knows about both views.
//
// It takes a `DiagramData` and mounts the elements that draw it: `<zx-graph>`
// for the diagram itself, `<zx-hypergraph>` for its dual, or both, stacked or
// side by side. What it does that neither of them can is derive the one from
// the other — `layout()` then `layoutHypergraph()` turns a diagram into the
// hypergraph input whose dots sit on the midpoints of its own wires — and hold
// the selection the pair shares.
//
// Everything a public element does around a painter — the presentation
// properties, the palette, the error state, the selection, and the stylesheet —
// is `ZxViewerHost`, which all three are built on. What is here is what belongs
// to *this* input: the diagram, the view mode, and the fact that drawing both
// views means laying the diagram out twice.

import { css, html, nothing, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { VIEW_MODES, type ViewMode } from './constants'
import {
  ZOOM as HYPERGRAPH_ZOOM,
  type HypergraphLayoutOptions,
  layoutHypergraph,
} from './hypergraph/layout'
import type { HypergraphInput } from './hypergraph/types'
import { layout } from './layout'
// `@zx-selection` in the template below is `SELECTION_EVENT`, written out
// because a Lit binding's name has to be a literal.
import { EMPTY_SELECTION } from './selection'
import type { DiagramData } from './types'
import { type PaintedView, ZxViewerHost } from './viewerHost'
import type { ZxGraphElement } from './zxGraph'
import type { ZxHypergraphElement } from './zxHypergraph'
import './zxGraph'
import './zxHypergraph'

/** `view-mode` is a plain string attribute, so the value that arrives is
 *  whatever was typed — `ViewMode` says nothing about it at runtime. */
function isViewMode(mode: string): mode is ViewMode {
  return (VIEW_MODES as readonly string[]).includes(mode)
}

/** Whether a mode runs both views — the one question most of this file asks
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

  /** What to mount, and what to hand each one. Which are non-null follows
   *  `viewMode`, so in either `both` mode they are populated together and both
   *  elements are rendered. */
  @state() private graph: { diagram: DiagramData; scale: number | null } | null = null
  @state() private dual: { hypergraph: HypergraphInput; scale: number } | null = null

  /** Nothing is painted here: each mounted element carries its own picture, and
   *  its own attribution badge measured against it. */
  protected get painted(): PaintedView[] {
    return []
  }

  /** The pair's own layout, on top of the host's stylesheet: everything else
   *  the shadow tree needs is the same for all three elements. */
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
         stretching the box. Each element's own scroll container fills the half
         it is given. */
      .views.horizontal > zx-graph,
      .views.horizontal > zx-hypergraph { flex: 1 1 0; min-width: 0; }
    `,
  ]

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
   * Build the views again, for consumers that mutate `diagram` in place rather
   * than replacing it.
   *
   * This produces a fresh drawing, which resets everything to it: dragged nodes
   * and dots return to their laid-out positions and the selection is cleared.
   * That is why it isn't run on every render — replacing `diagram` is the
   * cheaper and more predictable way to change the picture.
   *
   * The mounted elements are told as well. The dual gets a freshly derived
   * input and would relayout on its own, but `<zx-graph>` is handed the very
   * `diagram` object that was mutated, so nothing about it has changed
   * identity and only being asked will do.
   */
  refresh() {
    this.relayout()
    for (const child of this.renderRoot.querySelectorAll<ZxGraphElement | ZxHypergraphElement>(
      'zx-graph, zx-hypergraph',
    )) {
      child.refresh()
    }
  }

  protected relayout() {
    this.graph = null
    this.dual = null
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
      // The dual is derived from a `layout()` run here rather than from the one
      // `<zx-graph>` runs, because it needs the diagram at its *own* scale: in a
      // `both` mode the graph is drawn at `scale * ZOOM` so that the pair comes
      // out the same size, and the dual's dots are the midpoints of the wires
      // at the unzoomed scale, zoomed. The two are built into locals first, so
      // a hypergraph that can't be converted leaves no half-mounted pair behind
      // for the error state.
      if (this.diagram) {
        const both = isBoth(this.viewMode)
        const dual =
          this.viewMode === 'hypergraph' || both
            ? (() => {
                const scene = layout(this.diagram, { scale: this.scale ?? undefined })
                return {
                  scale: scene.scale,
                  hypergraph: layoutHypergraph(this.diagram, scene, {
                    boundaryBlobs: !this.disableIOBlobsInHypergraph,
                  }),
                }
              })()
            : null
        if (this.viewMode !== 'hypergraph') {
          // Drawing both means matching the hypergraph's roomier spacing; on its
          // own the graph is drawn at whatever scale was asked for.
          this.graph = {
            diagram: this.diagram,
            scale: dual ? dual.scale * HYPERGRAPH_ZOOM : this.scale,
          }
        }
        this.dual = dual
      }
      this.error = null
    } catch (e) {
      this.graph = null
      this.dual = null
      this.error = e instanceof Error ? e.message : String(e)
    }
  }

  render() {
    if (this.error !== null) return this.errorTemplate(this.error)
    if (!this.graph && !this.dual) return nothing

    // Only `both-horizontal` runs the pair across; every other mode stacks,
    // which for a lone view is the same box either way.
    const direction = this.viewMode === 'both-horizontal' ? 'horizontal' : 'vertical'
    return html`
      <div class="views ${direction}">
      ${
        this.graph === null
          ? nothing
          : html`
            <zx-graph
              .diagram=${this.graph.diagram}
              .scale=${this.graph.scale}
              .colors=${this.palette}
              .edgeColors=${this.edgeColors}
              .showLabels=${this.showLabels}
              .selection=${this.selection}
              @zx-selection=${this.onSelection}
            ></zx-graph>
          `
      }
      ${
        this.dual === null
          ? nothing
          : html`
            <zx-hypergraph
              .hypergraph=${this.dual.hypergraph}
              .scale=${this.dual.scale}
              .colors=${this.palette}
              .edgeColors=${this.edgeColors}
              .showLabels=${this.showLabels}
              .selection=${this.selection}
              @zx-selection=${this.onSelection}
            ></zx-hypergraph>
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
