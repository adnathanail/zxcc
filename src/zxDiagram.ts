import { brush } from 'd3-brush'
import { drag } from 'd3-drag'
import * as d3Selection from 'd3-selection'
import { symbol } from 'd3-shape'
import { css, html, LitElement, nothing } from 'lit'

// zxViewer.js expects a `d3` global with the handful of APIs it actually uses.
// `d3.event` is a live binding in d3-selection v1 (mutated during dispatch), so
// we expose it via a getter rather than destructuring — destructuring would
// freeze it at its initial `null`.
const d3 = {
  select: d3Selection.select,
  symbol,
  drag,
  brush,
  get event() {
    return d3Selection.event
  },
}

import { customElement, property } from 'lit/decorators.js'
import { ref } from 'lit/directives/ref.js'
import {
  type DiagramData,
  type RenderBox,
  type RenderData,
  render as renderDiagram,
} from './zxRender'
import zxViewerJs from './zxViewer.js'

let showGraphFn:
  | ((
      tag: HTMLElement,
      graph: unknown,
      width: number,
      height: number,
      scale: number,
      node_size: number,
      auto_hbox: boolean,
      show_labels: boolean,
      scalar_str: string,
      boxes: RenderBox[],
      labels: Map<number, string>,
    ) => void)
  | null = null

function getShowGraph(colors: Record<string, string>) {
  if (showGraphFn) return showGraphFn
  const mod: Record<string, unknown> = {}
  const fn = new Function(
    'exports',
    '_settings_colors',
    'd3',
    `${zxViewerJs}\nexports.showGraph = showGraph;`,
  )
  fn(mod, colors, d3)
  showGraphFn = mod.showGraph as NonNullable<typeof showGraphFn>
  return showGraphFn
}

@customElement('zx-diagram')
export class ZxDiagramElement extends LitElement {
  @property({ attribute: false }) diagram: DiagramData | null = null

  static styles = css`
    :host { display: block; }
    .container { overflow: auto; background-color: white; }
    .error { font-family: monospace; }
    .error pre { color: red; white-space: pre-wrap; word-break: break-word; margin: 0; }
    .error button { cursor: pointer; }
  `

  private mount(el: Element | undefined, renderData: RenderData) {
    if (!el) return
    const container = el as HTMLElement
    container.innerHTML = ''
    const show = getShowGraph(renderData.colors)
    show(
      container,
      renderData.graph,
      renderData.width,
      renderData.height,
      renderData.scale,
      renderData.node_size,
      renderData.auto_hbox,
      true,
      '',
      renderData.boxes,
      renderData.labels,
    )
  }

  render() {
    if (!this.diagram) return nothing

    let renderData: RenderData | null = null
    let error: string | null = null
    try {
      renderData = renderDiagram(this.diagram)
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
