import { css, html, LitElement, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { ref } from 'lit/directives/ref.js'
import { type DiagramData, type RenderData, render as renderDiagram } from './zxRender'
import { showGraph } from './zxViewer'

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
    showGraph(container, renderData.graph, {
      width: renderData.width,
      height: renderData.height,
      scale: renderData.scale,
      node_size: renderData.node_size,
      auto_hbox: renderData.auto_hbox,
      show_labels: true,
      scalar_str: '',
      boxes: renderData.boxes,
      labels: renderData.labels,
      colors: renderData.colors,
    })
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
