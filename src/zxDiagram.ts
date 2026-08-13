import * as d3 from 'd3'
import { css, html, LitElement, nothing } from 'lit'
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
