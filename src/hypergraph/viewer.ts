// `<zx-hypergraph-viewer>` — paints a `HypergraphScene`: a dot per ZX edge,
// and a blob around the dots of each ZX node's incident wires.
//
// The second painter alongside `<zx-viewer>`, and internal in the same way: it
// renders into the light DOM so it shares `<zx-diagram>`'s stylesheet and
// leaves the SVG reachable from the host's shadow root.
//
// Blob outlines are derived in `render()` from the dot positions rather than
// stored, so a drag only has to move a dot for every blob holding it to
// reshape. There is one piece of interaction state of its own — the dragged dot
// positions — plus the selection, which belongs to `<zx-diagram>` so that this
// view and the diagram view can share one. Everything else on screen, the
// outlined blobs and the ringed dots included, is derived from those two.

import { html, LitElement, nothing, type PropertyValues, type SVGTemplateResult, svg } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { type EdgeColors, edgeColor, nodeColor } from '../colors'
import { LABEL_FILL, ORIGINAL_COLORS, PHASE_FILL, SELECTED_STROKE } from '../constants'
import type { Point } from '../curves'
import {
  EMPTY_SELECTION,
  edgeSelection,
  nodeSelection,
  type Selection,
  selectionEvent,
} from '../selection'
import { blobCentre, blobHull, blobLabelAnchor, hullContains, hullPath } from './geometry'
import type { HypergraphBlob, HypergraphScene } from './types'

/** A blob is filled with its node's own palette colour and outlined in black,
 *  the way `<zx-viewer>` paints the node itself. The fill is part-transparent
 *  because the blobs overlap — every dot that isn't a boundary leg is shared by
 *  two of them — so an overlap reads as the two colours over each other. */
const BLOB_FILL_OPACITY = '0.4'
const BLOB_STYLE = 'stroke-width: 1.5px; stroke: black'
/**
 * Solid for what the press named, dashed for what that implies.
 *
 * One press picks out a whole neighbourhood — press a dot and you get the
 * hyperedges holding that wire and every other wire in them — and drawn in one
 * weight the neighbourhood swallows the thing at the middle of it, which is the
 * one mark you know is right. A dash is the usual way of saying "derived":
 * unbroken is what you pointed at, broken is what followed from it.
 *
 * The dashes are measured for the shape they go round — a blob's outline is a
 * long hull, a dot's ring is a circle a few pixels across, and one pattern
 * across both would read as coarse on one and as a solid line on the other.
 */
const SELECTED_STYLE = `stroke-width: 2px; stroke: ${SELECTED_STROKE}`
const IMPLIED_STYLE = `${SELECTED_STYLE}; stroke-dasharray: 6 4`
/** The leader line from a selected blob's caption to the blob itself. Dashed
 *  and thin so it reads as an annotation over the drawing rather than another
 *  wire in it. */
const LEADER_STYLE = `stroke: ${SELECTED_STROKE}; stroke-width: 1px; stroke-dasharray: 3 3; pointer-events: none`
/** Gap between the caption's baseline and the top of its leader line, so the
 *  line starts clear of the glyphs. */
const LEADER_GAP = 4
/** A blob's name, darker than the `LABEL_FILL` grey the wire ids take: it sits
 *  over a filled blob rather than on bare canvas. */
const NAME_FILL = '#555'
/** The ring drawn round a picked dot — solid for the one pressed, dashed for
 *  the ones a selected blob merely holds. See {@link SELECTED_STYLE}. */
const DOT_SELECTED_STYLE = `fill: none; stroke: ${SELECTED_STROKE}; stroke-width: 1.5px; pointer-events: none`
const DOT_IMPLIED_STYLE = `${DOT_SELECTED_STYLE}; stroke-dasharray: 4 3`
/** Gap between a dot's rim and its selection ring. */
const DOT_HALO = 2.5
/** The red which the part of a dot that has strayed into a blob not holding it
 *  is painted. */
const OVERLAP_FILL = '#e00'
/** How close the trespass tally may come to the bottom edge of the SVG. The
 *  canvas is grown to fit the blobs but not the wire ids written under them, so
 *  a diagram whose lowest dot sets the height can leave no strip to centre in.
 */
const TALLY_MARGIN = 8

/** How a mark came to be picked out: `named` is what the selection says
 *  outright and what was pressed, `implied` is what followed from it. The two
 *  are drawn solid and dashed respectively. */
type Pick = 'named' | 'implied'

/** Distinguishes one viewer's clip paths from another's. `url(#…)` resolves
 *  within the tree the reference sits in, and normally that is one
 *  `<zx-diagram>`'s shadow root with a single viewer in it — but two viewers
 *  in one light-DOM tree would otherwise share ids. */
let instances = 0

@customElement('zx-hypergraph-viewer')
export class ZxHypergraphViewerElement extends LitElement {
  @property({ attribute: false }) scene: HypergraphScene | null = null
  /** Palette to paint with, as `<zx-viewer>` takes. */
  @property({ attribute: false }) colors: Record<string, string> = ORIGINAL_COLORS
  /** Wire colours by edge kind, again as `<zx-viewer>` takes them: a dot is a
   *  wire, so it is painted from the same lookup the wire itself is. */
  @property({ attribute: false }) edgeColors: EdgeColors | null = null
  /** Draw each dot's wire id and each blob's name. With it off a blob still
   *  shows its phase, if it has one. */
  @property({ attribute: false }) showLabels = false
  /** Extra SVG painted on top, in the scene's coordinate space. */
  @property({ attribute: false }) overlay: SVGTemplateResult | null = null
  /** What is picked out, in the diagram's own terms — see `src/selection.ts`.
   *  The viewer is *controlled*: a press announces the selection it makes and
   *  draws whatever the host hands back, which is what lets the diagram view
   *  and this one track each other. Which blobs are outlined and which dots are
   *  ringed are both derived from it on every render. */
  @property({ attribute: false }) selection: Selection = EMPTY_SELECTION

  /** Where the dots have been dragged to. A plain field paired with an explicit
   *  `requestUpdate()`, as in `<zx-viewer>`: it is mutated in place during a
   *  gesture rather than reallocated on every mousemove just to trip Lit's
   *  identity check. */
  #positions = new Map<string, Point>()
  /** Tears down the in-flight drag, if any. */
  #endGesture: (() => void) | null = null
  /** Prefix for this viewer's clip-path ids — see {@link instances}. */
  #uid = `zxhg${++instances}`

  protected createRenderRoot() {
    return this
  }

  protected willUpdate(changed: PropertyValues<this>) {
    // A fresh scene is a fresh drawing: dragged dots go back to where the
    // layout put them, and the old ids may not even exist any more.
    if (changed.has('scene')) this.#adoptScene()
  }

  disconnectedCallback() {
    this.#endGesture?.()
    super.disconnectedCallback()
  }

  #adoptScene() {
    this.#endGesture?.()
    this.#positions = new Map(this.scene?.dots.map(d => [d.id, { x: d.x, y: d.y }]) ?? [])
  }

  /**
   * What the current selection picks out here: the blobs to outline and the
   * dots to ring, each with *how* it was picked.
   *
   * All of it is derived rather than stored, so the same selection reads the
   * same whether it was made in this view or in the diagram beside it.
   *
   * `named` is what the selection actually says — the blob standing for a
   * selected ZX node, the dot standing for a selected ZX edge. It is drawn
   * solid, and it is the thing that was pressed, in whichever view.
   *
   * `implied` is everything that follows, drawn dashed. A blob is implied when
   * it merely *holds* a selected wire, which is what a press on a dot produces:
   * that press asks which hyperedges the wire is part of, and the hyperedges
   * are the whole of the answer. The wires *those* hold are a further step out
   * again and are not marked — a press on one dot reaching a ring on five is
   * more than was asked, and it buries the dot you pressed in its own answer.
   *
   * A dot is implied when the selection names either of the ZX nodes it runs
   * between — a selected node's own legs, which is the same set as the dots of
   * the blob standing for it.
   */
  #picked(scene: HypergraphScene): { blobs: Map<string, Pick>; dots: Map<string, Pick> } {
    const { nodes, edges } = this.selection
    const blobs = new Map<string, Pick>()
    const dots = new Map<string, Pick>()

    for (const dot of scene.dots) {
      if (edges.has(dot.edge)) dots.set(dot.id, 'named')
      else if (nodes.has(dot.src) || nodes.has(dot.tgt)) dots.set(dot.id, 'implied')
    }
    for (const blob of scene.blobs) {
      if (nodes.has(blob.nodeId)) blobs.set(blob.id, 'named')
      else if (blob.dots.some(id => dots.get(id) === 'named')) blobs.set(blob.id, 'implied')
    }

    return { blobs, dots }
  }

  /** Run `onMove` for the rest of this gesture. Window-level listeners keep the
   *  drag alive when the pointer leaves the SVG. */
  #track(onMove: (e: MouseEvent) => void) {
    this.#endGesture?.()
    const up = () => this.#endGesture?.()
    this.#endGesture = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', up)
      this.#endGesture = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', up)
  }

  /**
   * A press on a dot selects the blobs that hold that wire and then drags it; a
   * press anywhere else selects whatever the point falls inside.
   *
   * Both are selections, but they answer different questions, so they are
   * tested differently. Pressing bare canvas or a blob asks "what is here?",
   * which is a question about the drawing — geometry. Pressing a *dot* asks
   * "which hyperedges is this wire part of?", which is a question about the
   * hypergraph — membership. A dot can easily sit inside a blob that doesn't
   * hold it, since a blob is a hull around its own dots and the drawing is
   * crowded; highlighting that blob would be answering with an accident of the
   * layout.
   *
   * What each press *names*, though, differs, and that is what the diagram
   * beside it reads. A press on canvas names the ZX nodes the blobs it hit
   * stand for, so those spiders come out selected in the diagram view. A press
   * on a dot names the ZX edge — the dot is that edge — so the wire is what
   * gets picked out over there, not the spiders at its ends. The blobs holding
   * it are still outlined here, because that is the question this view answers
   * about a wire; they are derived from the selected edge rather than named by
   * it (see `#picked`). Those blobs are as far as it goes, though: the *other*
   * wires they hold are a step further out again and get no mark, so the dot
   * pressed stays the one solid thing in its own answer.
   *
   * Dragging is what makes the view explorable: the blobs are derived from the
   * dot positions on every render, so pulling a dot about reshapes every blob
   * that holds it, live. Nothing is re-laid-out — the node a blob reaches from
   * stays where the diagram put it — so this shows the drawing under strain
   * rather than a different drawing. Selecting on the way in means the blobs
   * being reshaped are the ones picked out while you reshape them.
   */
  #onDown = (e: MouseEvent) => {
    const scene = this.scene
    if (!scene || e.button !== 0) return

    const dragged = (e.target as Element).closest('[data-wire]')?.getAttribute('data-wire')
    if (dragged) {
      const dot = scene.dots.find(d => d.id === dragged)
      if (dot) this.dispatchEvent(selectionEvent(edgeSelection([dot.edge])))
      this.#dragDot(dragged, e)
      return
    }

    const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    const point = { x: e.clientX - box.left, y: e.clientY - box.top }
    // Every blob the point is inside, not just the topmost one — the blobs
    // overlap by construction, and seeing which ones share a spot is the point.
    // On bare canvas that set is empty, which is how a selection is dropped.
    const hit = scene.blobs.filter(b =>
      hullContains(blobHull(b, this.#positions), scene.blobRadius, point),
    )
    this.dispatchEvent(selectionEvent(nodeSelection(hit.map(b => b.nodeId))))
  }

  /** Drag one dot. The dot follows the pointer from where it was pressed rather
   *  than by accumulated steps, so a drag can't drift from the pointer over a
   *  long gesture. */
  #dragDot(id: string, start: MouseEvent) {
    const origin = this.#positions.get(id)
    if (!origin) return
    this.#track(move => {
      this.#positions.set(id, {
        x: origin.x + move.clientX - start.clientX,
        y: origin.y + move.clientY - start.clientY,
      })
      this.requestUpdate()
    })
  }

  /** The blob's caption, as `<tspan>`s: the name in grey — dropped when labels
   *  are off, since it only repeats what the blob's colour already says — and
   *  the phase in `<zx-viewer>`'s blue, which stays either way because it is
   *  part of what the diagram *means*.
   *
   *  Built as an array rather than written out inline because Lit renders one
   *  with nothing between the items: a newline between two children of a
   *  `<text>` would render as a space and knock the caption off centre. */
  #blobCaption(blob: HypergraphBlob): SVGTemplateResult[] {
    const name = this.showLabels ? blob.name : ''
    const parts: SVGTemplateResult[] = []
    if (name) parts.push(svg`<tspan>${blob.phase ? `${name}(` : name}</tspan>`)
    if (blob.phase) parts.push(svg`<tspan fill=${PHASE_FILL}>${blob.phase}</tspan>`)
    if (name && blob.phase) parts.push(svg`<tspan>)</tspan>`)
    return parts
  }

  /** Where a blob's caption sits, or null when it has none to place. */
  #captionAnchor(scene: HypergraphScene, blob: HypergraphBlob): Point | null {
    if (this.#blobCaption(blob).length === 0) return null
    return blobLabelAnchor(blob, this.#positions, scene.blobRadius)
  }

  /**
   * The line joining a selected blob's caption to the blob it names.
   *
   * Captions sit a few pixels off the top of their outline and the blobs
   * overlap, so in a crowded drawing a caption appears to sit on several shapes
   * at once — which one it belongs to is exactly what is unclear. The line runs
   * all the way to the middle of the blob rather than stopping at its edge,
   * both because a line to the edge would be a few pixels long and because
   * ending inside the shape is what makes it unambiguous.
   *
   * Only the selection gets one: a line per blob would be as much clutter as
   * the ambiguity it fixes.
   */
  #renderLeader(scene: HypergraphScene, blob: HypergraphBlob) {
    const anchor = this.#captionAnchor(scene, blob)
    const end = blobCentre(blob, this.#positions)
    if (!anchor || !end) return nothing
    return svg`<line class="leader" data-hyperedge=${blob.id}
      x1=${anchor.x} y1=${anchor.y + LEADER_GAP} x2=${end.x} y2=${end.y} style=${LEADER_STYLE} />`
  }

  #renderBlob(
    scene: HypergraphScene,
    blob: HypergraphBlob,
    outline: string,
    picked: Pick | undefined,
  ) {
    const caption = this.#blobCaption(blob)
    const anchor = this.#captionAnchor(scene, blob)
    return svg`
      <g data-hyperedge=${blob.id}>
        <path class=${picked === 'implied' ? 'implied' : nothing}
          d=${outline}
          fill=${nodeColor(blob.kind, this.colors)} fill-opacity=${BLOB_FILL_OPACITY}
          stroke-linejoin="round"
          style=${picked === undefined ? BLOB_STYLE : picked === 'named' ? SELECTED_STYLE : IMPLIED_STYLE} />
        ${
          anchor
            ? svg`<text x=${anchor.x} y=${anchor.y} text-anchor="middle" font-size="11px"
                font-family="monospace" fill=${NAME_FILL}
                style="pointer-events: none; user-select: none;">${caption}</text>`
            : nothing
        }
      </g>`
  }

  /**
   * Each dot that has strayed into a blob not holding it, with the blobs it has
   * strayed into.
   *
   * A dot's circle meets a blob's outline exactly when its centre is within
   * `blobRadius + dotSize` of the blob's hull, which is {@link hullContains}
   * asked with a fattened radius — the same predicate the outline is drawn
   * with, so a dot cannot be marked as overlapping something it visibly clears.
   *
   * This asks every dot about every blob, so it is the reason the hulls are
   * computed once by the caller: derived per call it would be a hull per pair.
   */
  #trespasses(
    scene: HypergraphScene,
    pos: Map<string, Point>,
    hullOf: (blob: HypergraphBlob) => Point[],
  ) {
    const reach = scene.blobRadius + scene.dotSize
    return scene.dots
      .map(dot => {
        const centre = pos.get(dot.id) ?? { x: dot.x, y: dot.y }
        const blobs = scene.blobs.filter(
          b => !b.dots.includes(dot.id) && hullContains(hullOf(b), reach, centre),
        )
        return { dot, centre, blobs }
      })
      .filter(t => t.blobs.length > 0)
  }

  /**
   * How many dots are trespassing, written across the strip of canvas below the
   * drawing.
   *
   * The count is the one thing about the trespasses that the red marks
   * themselves can't say: each mark is local, and a dot half-buried under a
   * neighbouring blob is easy to miss entirely. It is painted in the same red
   * so the tally and the marks it counts read as one thing.
   *
   * `layout()` leaves padding under the diagram and `layoutHypergraph` grows
   * the canvas to whatever the blobs need, so the strip between the bottom of
   * the drawing and the bottom of the SVG is where the drawing isn't — the
   * tally goes in the middle of it.
   *
   * Measured from where the layout *put* the dots, not from where they have
   * been dragged to, so the text stays where it started for as long as the
   * scene does. It reads as a caption on the drawing rather than part of it,
   * and a caption that slid up and down while you dragged a dot would pull the
   * eye away from the thing being dragged. That also makes the position
   * independent of the interaction state, so it can't be chased off the canvas
   * by a dot dragged past the bottom edge.
   */
  #renderTally(scene: HypergraphScene, count: number) {
    if (count === 0) return nothing
    // The lowest thing painted: a blob's outline stands `blobRadius` off its
    // lowest dot, and a wire id is written under that again.
    const dotsBottom = scene.dots.reduce((y, d) => Math.max(y, d.y + scene.blobRadius), 0)
    const bottom = dotsBottom + (this.showLabels ? 14 : 0)
    const y = Math.min((bottom + scene.height) / 2, scene.height - TALLY_MARGIN)
    const label = `${count} trespassing node${count === 1 ? '' : 's'}`
    return svg`<text class="tally" x=${scene.width / 2} y=${y}
      text-anchor="middle" dominant-baseline="middle" font-size="12px"
      font-family="monospace" fill=${OVERLAP_FILL}
      style="pointer-events: none; user-select: none;">${label}</text>`
  }

  render() {
    const scene = this.scene
    if (!scene) return nothing
    const pos = this.#positions
    // An outline says which shapes are picked out, but a blob's hull is a
    // drawing decision — it is drawn round the dots it holds and will happily
    // enclose ones it doesn't — so the outline alone doesn't say which wires
    // are *in* them. Ringing the dots states that membership directly, and is
    // what makes the hyperedge's actual extent legible where the hulls overlap.
    const picked = this.#picked(scene)
    // Each blob's hull and the outline drawn from it, computed once and shared
    // by everything below. Three things want them — the painted outline, the
    // clip path a trespassing dot is masked to, and the trespass test itself,
    // which asks every dot about every blob — and deriving the hull inside each
    // would make that last one a sort per pair.
    const hulls = new Map(scene.blobs.map(b => [b.id, blobHull(b, pos)]))
    const hullOf = (blob: HypergraphBlob) => hulls.get(blob.id) ?? []
    const outlines = new Map(scene.blobs.map(b => [b.id, hullPath(hullOf(b), scene.blobRadius)]))
    const outlineOf = (blob: HypergraphBlob) => outlines.get(blob.id) ?? ''
    // Picked blobs paint last so their outline isn't buried under a
    // neighbour's fill — with this much overlap that is the difference
    // between seeing the highlighted shape and guessing at it — and the named
    // one last of all, since it is the one mark that is certainly right.
    const depth = (blob: HypergraphBlob) =>
      picked.blobs.get(blob.id) === 'named' ? 2 : picked.blobs.has(blob.id) ? 1 : 0
    const blobs = [...scene.blobs].sort((a, b) => depth(a) - depth(b))
    const trespasses = this.#trespasses(scene, pos, hullOf)

    return html`
      <svg width=${scene.width} height=${scene.height}
        style="max-width: none; max-height: none" @mousedown=${this.#onDown}>
        <!-- One clip per trespassing dot, holding the outlines of every blob it
             has strayed into: a clip path is the union of its children, so what
             comes through is the whole of the dot that is somewhere it should
             not be, however many blobs it overlaps at once. -->
        <defs>
          ${trespasses.map(
            ({ dot, blobs: wrong }) => svg`
              <clipPath id=${`${this.#uid}-${dot.id}`} clipPathUnits="userSpaceOnUse">
                ${wrong.map(b => svg`<path d=${outlineOf(b)} />`)}
              </clipPath>`,
          )}
        </defs>

        <g class="blob">
          ${blobs.map(blob =>
            this.#renderBlob(scene, blob, outlineOf(blob), picked.blobs.get(blob.id)),
          )}
        </g>

        <!-- Leaders are a layer of their own, above every blob: inside a blob's
             group each one would be painted over by whichever blobs come after
             it, and a half-covered line joining a caption to a shape is worse
             than no line. -->
        <g class="leader">
          ${blobs.filter(b => picked.blobs.has(b.id)).map(b => this.#renderLeader(scene, b))}
        </g>

        <g class="dot">
          ${scene.dots.map(
            dot => svg`
              <g data-wire=${dot.id} transform="translate(${pos.get(dot.id)?.x ?? dot.x},${
                pos.get(dot.id)?.y ?? dot.y
              })">
                <circle r=${scene.dotSize}
                  fill=${edgeColor(dot.kind, this.colors, this.edgeColors)} />
                ${
                  picked.dots.has(dot.id)
                    ? svg`<circle
                        class=${picked.dots.get(dot.id) === 'implied' ? 'selected implied' : 'selected'}
                        r=${scene.dotSize + DOT_HALO}
                        style=${
                          picked.dots.get(dot.id) === 'named'
                            ? DOT_SELECTED_STYLE
                            : DOT_IMPLIED_STYLE
                        } />`
                    : nothing
                }
                ${
                  this.showLabels
                    ? svg`<text y=${scene.blobRadius + 11} text-anchor="middle" font-size="10px"
                        font-family="monospace" fill=${LABEL_FILL}
                        style="pointer-events: none; user-select: none;">${dot.id}</text>`
                    : nothing
                }
              </g>`,
          )}
        </g>

        <!-- The red goes over the dot rather than replacing it, so a dot half
             inside a blob it doesn't belong to reads as half red. These sit in
             absolute coordinates, not in the dot's translated group, because a
             clip path is resolved in the coordinate system of whatever
             references it — inside the group the outlines would be shifted by
             the dot's own position. They carry data-wire so pressing the red
             part still drags and selects the dot underneath. -->
        <g class="overlap">
          ${trespasses.map(
            ({ dot, centre }) => svg`
              <circle data-wire=${dot.id} cx=${centre.x} cy=${centre.y} r=${scene.dotSize}
                fill=${OVERLAP_FILL} clip-path=${`url(#${this.#uid}-${dot.id})`} />`,
          )}
        </g>

        ${this.#renderTally(scene, trespasses.length)}
        ${this.overlay ?? nothing}
      </svg>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zx-hypergraph-viewer': ZxHypergraphViewerElement
  }
}
