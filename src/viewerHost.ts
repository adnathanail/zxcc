// What a public element does *around* a painter, shared by the two that exist:
// `<zx-diagram>`, which takes a ZX diagram, and `<zx-hypergraph>`, which takes a
// hypergraph. Both hold the same things — the presentation properties mirroring
// pyzx's `draw_d3` keyword arguments, the palette a scheme name resolves to,
// the error state, the selection, and the attribution badge that has to wait
// for the SVG to exist before it can be measured — and differ only in what they
// lay out and which painters they mount.
//
// The stylesheet is here for the same reason: both painters render into the
// light DOM, so it is the host's shadow root that has to carry the rules their
// SVG is styled by.

import { type CSSResultGroup, css, html, LitElement, type TemplateResult, unsafeCSS } from 'lit'
import { property, state } from 'lit/decorators.js'
import { placeAttribution } from './attribution'
import type { EdgeColors } from './colors'
import { CANVAS_FILL, COLOR_SCHEMES, type ColorSchemeName } from './constants'
import { EMPTY_SELECTION, type Selection } from './selection'

/** A painted view: the tag of the painter drawing it, and the pixel box the
 *  attribution badge is placed against. Both scene types have the two fields,
 *  which is all this layer needs of either. */
export type PaintedView = [tag: string, view: { width: number; height: number }]

export abstract class ZxViewerHost extends LitElement {
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

  /** What went wrong, drawn *instead of* the picture. Set by `relayout`. */
  @state() protected error: string | null = null

  /** What is picked out, held here rather than in a painter so that two of them
   *  track each other: it is stated in the diagram's own terms — ZX node ids
   *  and edge indices — and each painter draws whatever that means in its own
   *  picture. A painter announces the selection a gesture makes; a host is the
   *  only thing that stores one. */
  @state() protected selection: Selection = EMPTY_SELECTION

  protected onSelection = (e: Event) => {
    this.selection = (e as CustomEvent<Selection>).detail
  }

  // Container background is Bootstrap .bg-light-subtle
  // Attribution background is Bootstrap .bg-secondary-subtle w/ 50% transparency
  static styles: CSSResultGroup = css`
    :host { display: block; }
    .container { overflow: auto; background-color: white; }
    zx-viewer, zx-hypergraph-viewer { display: block; }
    .container svg {
      display: block;
      background-color: ${unsafeCSS(CANVAS_FILL)};
      /* A drag is a drag, not a text selection: without this a gesture across
         the picture highlights the labels it passes over, and a long press on
         iOS opens the selection callout over whatever is being dragged. */
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
    }
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
  protected placementPending = false

  /** The views being painted, each with the tag of the painter drawing it, in
   *  stack order. Every one carries its own attribution badge, placed against
   *  its own pixel bounds — the badge belongs to the picture, not to the
   *  element, so a copied SVG takes it along whichever of a pair it is. */
  protected abstract get painted(): PaintedView[]

  /** Build the views again from whatever this host takes as input. Called by
   *  the error state's Retry button, so every host has to have one. */
  protected abstract relayout(): void

  /** The palette a painter is handed: an explicit `colors` override wins over
   *  the named scheme, and an unknown scheme name falls back to pyzx's
   *  original. `edgeColors` rides alongside rather than being folded in — a
   *  kind of your own has no pyzx entry to fold into. */
  protected get palette(): Record<string, string> {
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
    await this.paintersComplete()
    // A relayout during that await leaves us holding views that are no longer
    // painted; whichever update cycle installed the new ones places their
    // badges.
    if (!sameViews(views, this.painted)) return
    // Each badge is measured against its own painter's box, and the pass only
    // counts as done once every one of them has been placed — one view can be
    // measurable while the other still isn't.
    const placed = views.map(([tag, view]) => {
      const group = this.renderRoot.querySelector<SVGGElement>(`${tag} g.attribution`)
      return group !== null && placeAttribution(group, view.width, view.height)
    })
    if (placed.every(Boolean)) this.placementPending = false
  }

  /** The error state: the message, and a Retry that lays out again. Rendered
   *  instead of the picture, so an element reporting an error has no painter
   *  mounted at all. */
  protected errorTemplate(message: string): TemplateResult {
    return html`
      <div class="error">
        <pre>${message}</pre>
        <button type="button" @click=${() => this.relayout()}>Retry</button>
      </div>
    `
  }
}

/** Whether the same scene objects are still the ones being painted. Identity,
 *  not contents: a relayout produces fresh objects, which is exactly the case
 *  this is watching for. */
function sameViews(before: PaintedView[], after: PaintedView[]): boolean {
  return before.length === after.length && before.every(([, view], i) => view === after[i]?.[1])
}
