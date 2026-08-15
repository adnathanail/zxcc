import { css, html, LitElement, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { ref } from 'lit/directives/ref.js'
import {
  COLOR_SCHEMES,
  type ColorSchemeName,
  type DiagramData,
  type RenderData,
  render as renderDiagram,
} from './zxRender'
import { showGraph } from './zxViewer'

const SVG_NS = 'http://www.w3.org/2000/svg'

// Padding between the attribution text and the edges of its backing chip.
const ATTR_PAD = 3

interface Attribution {
  g: SVGGElement
  text: SVGTextElement
  chip: SVGRectElement
  width: number
  height: number
}

// Draw the attribution as SVG content in the diagram's own coordinate space,
// roughly at the bottom-right corner. Final sizing and placement need the SVG
// to be laid out, so they happen later (see placeAttribution).
function addAttribution(svg: SVGSVGElement, width: number, height: number): Attribution {
  const url = `https://github.com/adnathanail/zxcc/releases/tag/v${__ZXCC_VERSION__}`
  const g = document.createElementNS(SVG_NS, 'g')
  g.setAttribute('class', 'attribution')

  const chip = document.createElementNS(SVG_NS, 'rect')
  g.appendChild(chip)

  const text = document.createElementNS(SVG_NS, 'text')
  text.setAttribute('x', String(width - ATTR_PAD))
  text.setAttribute('y', String(height - ATTR_PAD - 1))
  text.setAttribute('text-anchor', 'end')
  const heart = document.createElementNS(SVG_NS, 'tspan')
  heart.textContent = '❤️'
  text.appendChild(heart)

  const link = document.createElementNS(SVG_NS, 'a')
  link.setAttribute('href', url)
  link.setAttribute('target', '_blank')
  link.setAttribute('rel', 'noopener noreferrer')
  const title = document.createElementNS(SVG_NS, 'title')
  title.textContent = `zxcc v${__ZXCC_VERSION__}`
  link.appendChild(title)
  const name = document.createElementNS(SVG_NS, 'tspan')
  name.setAttribute('dx', '3')
  name.textContent = 'zxcc'
  link.appendChild(name)
  text.appendChild(link)

  g.appendChild(text)
  svg.appendChild(g)
  return { g, text, chip, width, height }
}

// Size the chip around the laid-out text and nudge the whole group so the
// padded chip sits flush in the SVG's bottom-right corner — exact whatever the
// font's advance widths and descender depth turn out to be. getBBox needs a
// rendered element: it throws in jsdom and reports zeros while the SVG is
// detached or hidden, in which case the chip stays unsized (invisible) and the
// text alone is shown at its unadjusted position.
function placeAttribution({ g, text, chip, width, height }: Attribution): void {
  let box: DOMRect
  try {
    box = text.getBBox()
  } catch {
    return
  }
  if (box.width === 0) return
  const left = box.x - ATTR_PAD
  const top = box.y - ATTR_PAD
  const boxWidth = box.width + 2 * ATTR_PAD
  const boxHeight = box.height + 2 * ATTR_PAD
  chip.setAttribute('x', String(left))
  chip.setAttribute('y', String(top))
  chip.setAttribute('width', String(boxWidth))
  chip.setAttribute('height', String(boxHeight))
  g.setAttribute(
    'transform',
    `translate(${width - (left + boxWidth)},${height - (top + boxHeight)})`,
  )
}

// A plain `{type: Boolean}` attribute can't express "off" for a property that
// defaults to true — absence and `="false"` would both have to mean false.
// This treats an explicit "false" as off and presence/""/"true" as on.
const defaultTrueBoolean = {
  fromAttribute: (value: string | null) => value !== null && value !== 'false',
}

@customElement('zx-diagram')
export class ZxDiagramElement extends LitElement {
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

  // Container background is Bootstrap .bg-light-subtle
  // Attribution background is Bootstrap .bg-secondary-subtle w/ 50% transparency
  static styles = css`
    :host { display: block; }
    .container { overflow: auto; background-color: white; }
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

  // Set by mount(), consumed by updated() — the ref callback runs while Lit's
  // template fragment is still detached, where getBBox can't measure anything.
  private pendingAttribution: Attribution | null = null

  private mount(el: Element | undefined, renderData: RenderData) {
    if (!el) return
    const container = el as HTMLElement
    container.innerHTML = ''
    showGraph(container, renderData.graph, {
      width: renderData.width,
      height: renderData.height,
      scale: renderData.scale,
      node_size: renderData.node_size,
      auto_hbox: renderData.auto_hbox,
      show_labels: this.showLabels,
      scalar_str: renderData.scalar_str,
      scalar_y: renderData.scalar_y,
      boxes: renderData.boxes,
      labels: renderData.labels,
      colors: renderData.colors,
    })
    const svg = container.querySelector('svg')
    this.pendingAttribution = svg ? addAttribution(svg, renderData.width, renderData.height) : null
  }

  updated() {
    if (!this.pendingAttribution) return
    const attribution = this.pendingAttribution
    this.pendingAttribution = null
    placeAttribution(attribution)
  }

  render() {
    if (!this.diagram) return nothing

    let renderData: RenderData | null = null
    let error: string | null = null
    try {
      renderData = renderDiagram(this.diagram, {
        colors: this.colors ?? COLOR_SCHEMES[this.colorScheme] ?? COLOR_SCHEMES.original,
        scale: this.scale ?? undefined,
      })
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }

    if (error) {
      return html`
        <div class="error">
          <pre>${error}</pre>
          <button type="button" @click=${() => this.requestUpdate()}>Retry</button>
        </div>
      `
    }
    return html`
      <div
        class="container"
        ${ref(el => renderData && this.mount(el, renderData))}
      ></div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zx-diagram': ZxDiagramElement
  }
}
