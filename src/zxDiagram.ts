import { css, html, LitElement, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { ref } from 'lit/directives/ref.js'
import { type DiagramData, type RenderData, render as renderDiagram } from './zxRender'
import { showGraph } from './zxViewer'

@customElement('zx-diagram')
export class ZxDiagramElement extends LitElement {
  @property({ attribute: false }) diagram: DiagramData | null = null

  // Container background is Bootstrap .bg-light-subtle
  // Attribution background is Bootstrap .bg-secondary-subtle w/ 50% transparency
  static styles = css`
    :host { display: block; }
    .container { position: relative; overflow: auto; background-color: white; }
    .container svg { background-color: rgb(252, 252, 253); }
    .error { font-family: monospace; }
    .error pre { color: red; white-space: pre-wrap; word-break: break-word; margin: 0; }
    .error button { cursor: pointer; }
    .attribution {
      position: absolute;
      font: 11px/1 system-ui, sans-serif;
      color: #333;
      background: rgba(226, 227, 229, 0.5);
      padding: 3px 3px 4px 2px;
    }
    .attribution a { color: #0366d6; text-decoration: none; }
    .attribution a:hover { text-decoration: underline; }
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
    const attr = document.createElement('div')
    attr.className = 'attribution'
    attr.innerHTML = `❤️ <a href="https://github.com/adnathanail/zxcc/releases/tag/v${__ZXCC_VERSION__}" target="_blank" rel="noopener noreferrer" title="zxcc v${__ZXCC_VERSION__}">zxcc</a>`
    // Anchor to the SVG's bottom-right in the container's scroll coordinates,
    // so it hugs the diagram rather than the visible viewport.
    attr.style.left = `${renderData.width - 48}px`
    attr.style.top = `${renderData.height - 18}px`
    container.appendChild(attr)
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
