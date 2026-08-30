// Behaviour common to the three public elements — `<zx-graph>`,
// `<zx-hypergraph>` and `<zx-diagram>`: the presentation properties, the
// palette a scheme name resolves to, the error state, the selection, the
// attribution badge's measuring pass, and the stylesheet the painters are
// styled by.
//
// Both painters render into the light DOM, so it is the host's shadow root
// that carries the rules their SVG is styled by.
//
// A subclass supplies three things: `painted` (the views it has mounted),
// `clear()` and `build()` (how it discards and rebuilds them).

import { type CSSResultGroup, css, html, LitElement, type TemplateResult, unsafeCSS } from 'lit'
import { property, state } from 'lit/decorators.js'
import { placeAttribution } from './attribution'
import type { EdgeColors } from './colors'
import { CANVAS_FILL, COLOR_SCHEMES, type ColorSchemeName } from './constants'
import { EMPTY_SELECTION, type Selection, selectionEvent } from './selection'

/** A painted view: the tag of the painter drawing it, and the pixel box its
 *  attribution badge is placed against. Both scene types have those two
 *  fields, which is all this layer needs of either. */
export type PaintedView = [tag: string, view: { width: number; height: number }]

export abstract class ZxViewerHost extends LitElement {
  /** Draw each node's id above it (pyzx's `draw_d3(labels=...)`). Off by
   *  default, as in pyzx: an id is a fact about the data structure rather than
   *  about the diagram. A bare `show-labels` attribute turns it on. */
  @property({ attribute: 'show-labels', type: Boolean })
  showLabels = false

  /** Named pyzx palette. Ignored when `colors` is set. */
  @property({ attribute: 'color-scheme' }) colorScheme: ColorSchemeName = 'original'

  /** Full palette override, keyed as in `pyzx.utils.original_colors`. */
  @property({ attribute: false }) colors: Record<string, string> | null = null

  /** Wire colours by edge kind — `{ hadamard: '#f60', control: 'grey' }`.
   *  Wins over both `colors` and `color-scheme`, and only for the kinds named.
   *  Keyed by `DiagramEdge['kind']` rather than by pyzx's `Hedge`/`Xedge`/`edge`
   *  entry names, so a diagram can invent kinds: any string is a kind, and this
   *  is where it gets a colour. A kind with no colour here draws like a plain
   *  wire. */
  @property({ attribute: false }) edgeColors: EdgeColors | null = null

  /** What went wrong, drawn *instead of* the picture. Set by {@link relayout}. */
  @state() protected error: string | null = null

  /** What is picked out, stated in the diagram's own terms — ZX node ids and
   *  edge indices — so that each painter can draw whatever that means in its
   *  own picture.
   *
   *  A property rather than private state so that a host mounted inside another
   *  can be driven by it: `<zx-diagram>` sets this on both of its children.
   *  Set it to pick something out from outside; listen for `zx-selection` to
   *  hear what a gesture picked. */
  @property({ attribute: false }) selection: Selection = EMPTY_SELECTION

  /** Store the selection a child announced and announce it again as this
   *  element's own, so a gesture reaches the host that mounted the painter and
   *  `zx-selection` fires on whichever element is in the page. */
  protected onSelection = (e: Event) => {
    const selection = (e as CustomEvent<Selection>).detail
    this.selection = selection
    this.dispatchEvent(selectionEvent(selection))
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

  /** Whether a badge still needs placing. Stays set until a measurement
   *  succeeds: the text measures zero-wide inside a hidden ancestor, and a
   *  later render is the only chance to catch it once it is on screen. */
  protected placementPending = false

  /** The views being painted, each with the tag of the painter drawing it, in
   *  stack order. Every one carries its own attribution badge, placed against
   *  its own pixel bounds, so a copied SVG takes the badge with it. */
  protected abstract get painted(): PaintedView[]

  /** Discard whatever this host has built, leaving it with nothing painted. */
  protected abstract clear(): void

  /** Build this host's views from its current input. Throws on an input that
   *  can't be drawn; {@link relayout} turns that into the error state. */
  protected abstract build(): void

  /**
   * Build the views again from the current input.
   *
   * This resets the drawing: dragged marks go back to where the layout put
   * them, and the selection is dropped, since it names ids the new drawing may
   * not have. Building into a cleared host means a failure leaves nothing
   * half-built behind the error state.
   */
  protected relayout() {
    this.clear()
    this.selection = EMPTY_SELECTION
    try {
      this.build()
      this.error = null
    } catch (e) {
      this.clear()
      this.error = e instanceof Error ? e.message : String(e)
    }
    this.placementPending = this.painted.length > 0
  }

  /**
   * Build again, for consumers that mutate their input in place rather than
   * replacing it. Replacing the object is the cheaper and more predictable way
   * to change the picture, which is why this isn't run on every render.
   */
  refresh() {
    this.relayout()
  }

  /** The palette a painter is handed: an explicit `colors` override wins over
   *  the named scheme, and an unknown scheme name falls back to pyzx's
   *  original. `edgeColors` rides alongside rather than being folded in, since
   *  a kind of your own has no pyzx entry to fold into. */
  protected get palette(): Record<string, string> {
    return this.colors ?? COLOR_SCHEMES[this.colorScheme] ?? COLOR_SCHEMES.original
  }

  /** Everything mounted below that renders on its own update cycle: the two
   *  painters, and the two hosts `<zx-diagram>` mounts, which await their own
   *  painters in turn. */
  private get painters(): LitElement[] {
    return [
      ...this.renderRoot.querySelectorAll<LitElement>(
        'zx-viewer, zx-hypergraph-viewer, zx-graph, zx-hypergraph',
      ),
    ]
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

  /** Place each badge against its own painter's box. Deferred to `updated()`
   *  because the chip can only be sized once the text has been laid out, and
   *  skipped unless a box moved, since `getBBox()` forces a reflow. */
  protected async updated() {
    const views = this.painted
    if (!this.placementPending || views.length === 0) return
    await this.paintersComplete()
    // A relayout during that await leaves us holding views that are no longer
    // painted; whichever update cycle installed the new ones places their
    // badges.
    if (!sameViews(views, this.painted)) return
    // The pass only counts as done once every badge has been placed — one view
    // can be measurable while the other still isn't.
    const placed = views.map(([tag, view]) => {
      const group = this.renderRoot.querySelector<SVGGElement>(`${tag} g.attribution`)
      return group !== null && placeAttribution(group, view.width, view.height)
    })
    if (placed.every(Boolean)) this.placementPending = false
  }

  /** The error state: the message, and a Retry that builds again. Rendered
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
 *  not contents: a relayout produces fresh objects, which is the case this is
 *  watching for. */
function sameViews(before: PaintedView[], after: PaintedView[]): boolean {
  return before.length === after.length && before.every(([, view], i) => view === after[i]?.[1])
}
