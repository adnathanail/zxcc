// `<zx-diagram>` — the public element for a ZX diagram, and the only file that
// knows about both views.
//
// It takes a `DiagramData` and mounts the elements that draw it: `<zx-graph>`
// for the diagram itself, `<zx-hypergraph>` for its dual, or both, stacked or
// side by side. What it does that neither of them can is derive the one from
// the other — `layout()` then `layoutHypergraph()` turns a diagram into the
// hypergraph input whose dots sit on the midpoints of its own wires — and hold
// the selection the pair shares.

import { css, html, nothing, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { VIEW_MODES, type ViewMode } from './constants'
import {
  ZOOM as HYPERGRAPH_ZOOM,
  // oxlint-disable-next-line no-unused-vars -- named by a {@link} in a doc comment
  type HypergraphLayoutOptions,
  layoutHypergraph,
} from './hypergraph/layout'
import type { HypergraphInput } from './hypergraph/types'
import { layout } from './layout'
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

/** What to hand the mounted `<zx-hypergraph>`. */
interface Dual {
  hypergraph: HypergraphInput
  scale: number
}

@customElement('zx-diagram')
export class ZxDiagramElement extends ZxViewerHost {
  /** The diagram to draw. Replace the object to change it — layout runs on a
   *  new identity, so mutating the one already assigned paints nothing new.
   *  {@link refresh} is the escape hatch if you must mutate in place. */
  @property({ attribute: false }) diagram: DiagramData | null = null

  /** Pixels per row/qubit. Null derives it from the diagram's extent; anything
   *  else that isn't a positive number is an error. */
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
   *  `viewMode`, so in either `both` mode they are populated together. */
  @state() private graph: { diagram: DiagramData; scale: number | null } | null = null
  @state() private dual: Dual | null = null

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
   * The mounted elements are told as well. The dual gets a freshly derived
   * input and would relayout on its own, but `<zx-graph>` is handed the very
   * `diagram` object that was mutated, so nothing about it has changed identity
   * and only being asked will do.
   */
  override refresh() {
    super.refresh()
    for (const child of this.renderRoot.querySelectorAll<ZxGraphElement | ZxHypergraphElement>(
      'zx-graph, zx-hypergraph',
    )) {
      child.refresh()
    }
  }

  protected clear() {
    this.graph = null
    this.dual = null
  }

  protected build() {
    if (!isViewMode(this.viewMode)) {
      throw new Error(
        `Unknown view-mode '${String(this.viewMode)}'. Expected one of: ${VIEW_MODES.join(', ')}.`,
      )
    }
    const scale = this.givenScale(this.scale)
    if (!this.diagram) return

    // The dual is derived from a `layout()` run here rather than from the one
    // `<zx-graph>` runs, because it needs the diagram at its *own* scale: in a
    // `both` mode the graph is drawn at `scale * ZOOM` so that the pair comes
    // out the same size, and the dual's dots are the midpoints of the wires at
    // the unzoomed scale, zoomed.
    let dual: Dual | null = null
    if (this.viewMode !== 'graph') {
      const scene = layout(this.diagram, { scale })
      dual = {
        scale: scene.scale,
        hypergraph: layoutHypergraph(this.diagram, scene, {
          boundaryBlobs: !this.disableIOBlobsInHypergraph,
        }),
      }
    }
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

  render() {
    if (this.error !== null) return this.errorTemplate(this.error)
    if (!this.graph && !this.dual) return nothing

    // Only `both-horizontal` runs the pair across; every other mode stacks,
    // which for a lone view is the same box either way.
    const direction = this.viewMode === 'both-horizontal' ? 'horizontal' : 'vertical'
    // `@zx-selection` is `SELECTION_EVENT`, written out because a Lit binding's
    // name has to be a literal.
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
