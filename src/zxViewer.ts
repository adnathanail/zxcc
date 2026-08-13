// D3-free reimplementation of pyzx's zx_viewer.inline.js. Renders a ZX
// diagram into a container element using plain SVG DOM + native events.
// Behaviour parity with the vendored pyzx code (including the H-box chain
// fix): single mount per call, no update/exit cycle.

import type { GraphData, GraphLink, GraphNode, RenderBox } from './zxRender'

const SVG_NS = 'http://www.w3.org/2000/svg'

type Attrs = Record<string, string | number | null | undefined>

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Attrs,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag)
  if (attrs) setAttrs(el, attrs)
  return el
}

function setAttrs(el: SVGElement, attrs: Attrs): void {
  for (const k in attrs) {
    const v = attrs[k]
    if (v !== null && v !== undefined) el.setAttribute(k, String(v))
  }
}

function nodeStyle(selected: boolean): string {
  return selected ? 'stroke-width: 2px; stroke: #00f' : 'stroke-width: 1.5px'
}

// H-box chain draws a ground-symbol path in coordinates: a vertical stem,
// then three horizontal strokes of decreasing width — the pyzx symbol.
// `s = size / 2` matches d3.symbol()'s handoff to symbolGround.draw().
function groundSymbolPath(size: number): string {
  const s = size / 2
  const t = (s * 2) / 3
  const u = s / 3
  return (
    `M 0 ${-s} L 0 0 ` +
    `M ${-s} 0 L ${s} 0 ` +
    `M ${-t} ${u} L ${t} ${u} ` +
    `M ${-u} ${2 * u} L ${u} ${2 * u}`
  )
}

interface LiveNode extends GraphNode {
  selected: boolean
  previouslySelected: boolean
  nhd: LiveNode[]
  lineParam?: number
  _group?: SVGGElement
  _selectables: SVGElement[]
}

interface LiveLink extends Omit<GraphLink, 'source' | 'target'> {
  source: LiveNode
  target: LiveNode
  _el?: SVGPathElement
}

interface LiveBox extends RenderBox {
  _el?: SVGRectElement
}

interface LiveGraph {
  nodes: LiveNode[]
  links: LiveLink[]
  pauli_web: { source: LiveNode; target: LiveNode; t: string; _el?: SVGPathElement }[]
}

export interface ShowGraphOptions {
  width: number
  height: number
  scale: number
  node_size: number
  auto_hbox: boolean
  show_labels: boolean
  scalar_str: string
  boxes: RenderBox[]
  labels: Map<number, string>
  colors: Record<string, string>
}

function nodeColor(t: number, colors: Record<string, string>): string {
  switch (t) {
    case 0:
      return colors.boundary
    case 1:
      return colors.Z
    case 2:
      return colors.X
    case 3:
      return colors.H
    case 4:
      return colors.W
    case 5:
      return colors.Walt
    case 6:
      return colors.Zalt
    default:
      return colors.boundary
  }
}

function edgeColor(t: number, colors: Record<string, string>): string {
  switch (t) {
    case 1:
      return colors.edge
    case 2:
      return colors.Hedge
    case 3:
      return colors.Xedge
    default:
      return colors.edge
  }
}

function webColor(t: string, colors: Record<string, string>): string {
  switch (t) {
    case 'X':
      return colors.Xdark
    case 'Y':
      return colors.Ydark
    case 'Z':
      return colors.Zdark
    case 'I':
      return '#dddddd'
    default:
      return colors.Xdark
  }
}

export function showGraph(tag: HTMLElement, graphIn: GraphData, opts: ShowGraphOptions): void {
  const {
    width,
    height,
    scale,
    node_size,
    auto_hbox,
    show_labels,
    scalar_str,
    boxes: boxesIn,
    labels,
    colors,
  } = opts

  const labelFor = (d: LiveNode): string | undefined => labels.get(parseInt(d.name, 10))

  // Adopt the graph as our live typed structure. Nodes and links point at
  // one another after resolution below.
  const graph: LiveGraph = {
    nodes: graphIn.nodes.map(n => ({
      ...n,
      selected: false,
      previouslySelected: false,
      nhd: [],
      _selectables: [],
    })),
    links: [] as LiveLink[],
    pauli_web: [] as LiveGraph['pauli_web'],
  }

  const ntab: Record<string, LiveNode> = {}
  for (const n of graph.nodes) ntab[n.name] = n

  for (const l of graphIn.links) {
    const s = ntab[l.source as unknown as string]
    const t = ntab[l.target as unknown as string]
    s.nhd.push(t)
    t.nhd.push(s)
    graph.links.push({ ...l, source: s, target: t })
  }

  const boxes: LiveBox[] = boxesIn.map(b => ({ ...b }))

  const groundOffset = 2.5 * node_size

  // Minimum lineParam distance between adjacent H-boxes and endpoints.
  const hboxMargin = 0.05

  // Trace an H-box chain to its non-H-box endpoints. Returns the ordered
  // list of chain hboxes plus the index of `d` within that list.
  function getHboxChainInfo(
    d: LiveNode,
  ): { endpointA: LiveNode; endpointB: LiveNode; hboxes: LiveNode[]; index: number } | null {
    if (d.t !== 3 || d.nhd.length !== 2) return null
    const trace = (
      start: LiveNode,
      prev: LiveNode,
    ): { endpoint: LiveNode | null; chain: LiveNode[] } => {
      const chain: LiveNode[] = []
      let current = start
      let p = prev
      while (current.t === 3 && current.nhd.length === 2) {
        chain.push(current)
        const next = current.nhd[0] === p ? current.nhd[1] : current.nhd[0]
        p = current
        current = next
      }
      return { endpoint: current.t !== 3 ? current : null, chain }
    }
    const left = trace(d.nhd[0], d)
    const right = trace(d.nhd[1], d)
    if (!left.endpoint || !right.endpoint) return null
    const hboxes = left.chain.reverse().concat([d]).concat(right.chain)
    return { endpointA: left.endpoint, endpointB: right.endpoint, hboxes, index: left.chain.length }
  }

  // Evenly space chained H-boxes along their line at first paint.
  const visited: Record<string, true> = {}
  for (const d of graph.nodes) {
    if (d.t === 3 && !visited[d.name]) {
      const info = getHboxChainInfo(d)
      if (info) {
        for (let i = 0; i < info.hboxes.length; i++) {
          info.hboxes[i].lineParam = (i + 1) / (info.hboxes.length + 1)
          visited[info.hboxes[i].name] = true
        }
      } else {
        d.lineParam = 0.5
      }
    }
  }

  // -- SVG scaffold --
  const svg = svgEl('svg', {
    style: 'max-width: none; max-height: none',
    width,
    height,
  })
  tag.appendChild(svg)

  const box_pad = 0.4 * scale + node_size

  const boxLayer = svgEl('g', { class: 'boxes', 'pointer-events': 'none' })
  svg.appendChild(boxLayer)
  for (const b of boxes) {
    const rect = svgEl('rect', {
      rx: 4,
      ry: 4,
      fill: b.kind === 'stack' ? 'rgba(255,165,80,0.10)' : 'rgba(100,160,255,0.10)',
      stroke: b.kind === 'stack' ? 'rgba(220,130,30,0.65)' : 'rgba(50,110,220,0.65)',
      'stroke-width': 1,
      'stroke-dasharray': b.kind === 'stack' ? '4 3' : '0',
    })
    b._el = rect
    boxLayer.appendChild(rect)
  }

  function updateBoxes(): void {
    for (const b of boxes) {
      if (!b._el) continue
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity
      let found = false
      for (const id of b.nodeIds) {
        const n = ntab[String(id)]
        if (!n) continue // wire-spliced id, skip
        found = true
        if (n.x < minX) minX = n.x
        if (n.y < minY) minY = n.y
        if (n.x > maxX) maxX = n.x
        if (n.y > maxY) maxY = n.y
      }
      if (!found) {
        b._el.setAttribute('display', 'none')
        continue
      }
      setAttrs(b._el, {
        display: null,
        x: minX - box_pad,
        y: minY - box_pad,
        width: maxX - minX + 2 * box_pad,
        height: maxY - minY + 2 * box_pad,
      })
      // setAttribute doesn't remove; if display was 'none' we need to strip it.
      if (b._el.getAttribute('display') === 'null') b._el.removeAttribute('display')
    }
  }

  const webLayer = svgEl('g', { class: 'web' })
  svg.appendChild(webLayer)
  for (const w of graph.pauli_web) {
    const p = svgEl('path', {
      stroke: webColor(w.t, colors),
      fill: 'transparent',
      style: 'stroke-width: 7px',
    })
    w._el = p
    webLayer.appendChild(p)
  }

  const linkLayer = svgEl('g', { class: 'link' })
  svg.appendChild(linkLayer)
  for (const l of graph.links) {
    const p = svgEl('path', {
      stroke: edgeColor(l.t, colors),
      fill: 'transparent',
      style: 'stroke-width: 1.5px',
    })
    l._el = p
    linkLayer.appendChild(p)
  }

  const brushLayer = svgEl('g', { class: 'brush' })
  svg.appendChild(brushLayer)
  // Invisible full-canvas rect so brush drags start anywhere on the SVG.
  const brushHit = svgEl('rect', {
    x: 0,
    y: 0,
    width,
    height,
    fill: 'transparent',
  })
  brushLayer.appendChild(brushHit)

  const nodeLayer = svgEl('g', { class: 'node' })
  svg.appendChild(nodeLayer)
  for (const d of graph.nodes) {
    const g = svgEl('g', { transform: `translate(${d.x},${d.y})` })
    d._group = g
    nodeLayer.appendChild(g)

    if (d.ground) {
      const stem = svgEl('path', {
        stroke: 'black',
        style: 'stroke-width: 1.5px',
        fill: 'none',
        d: `M 0 0 L 0 ${groundOffset}`,
        class: 'selectable',
      })
      g.appendChild(stem)
      d._selectables.push(stem)
      const sym = svgEl('path', {
        stroke: 'black',
        style: 'stroke-width: 1.5px',
        fill: 'none',
        d: groundSymbolPath(node_size * 1.5),
        transform: `translate(0,${groundOffset})`,
        class: 'selectable',
      })
      g.appendChild(sym)
      d._selectables.push(sym)
    }

    if (d.t !== 3 && d.t !== 5 && d.t !== 6) {
      const r = d.t === 0 ? 0.5 * node_size : d.t === 4 ? 0.2 * node_size : node_size
      const circle = svgEl('circle', {
        r,
        fill: nodeColor(d.t, colors),
        stroke: 'black',
        class: 'selectable',
      })
      g.appendChild(circle)
      d._selectables.push(circle)
    }

    if (d.t === 3) {
      const rect = svgEl('rect', {
        x: -0.75 * node_size,
        y: -0.75 * node_size,
        width: node_size * 1.5,
        height: node_size * 1.5,
        fill: nodeColor(d.t, colors),
        stroke: 'black',
        class: 'selectable',
      })
      g.appendChild(rect)
      d._selectables.push(rect)
    }

    if (d.t === 5) {
      const tri = svgEl('path', {
        d: `M 0 0 L ${node_size} ${node_size} L ${-node_size} ${node_size} Z`,
        fill: nodeColor(d.t, colors),
        stroke: 'black',
        class: 'selectable',
        transform: `translate(${-node_size / 2}, 0) rotate(-90)`,
      })
      g.appendChild(tri)
      d._selectables.push(tri)
    }

    if (d.t === 6) {
      const rect = svgEl('rect', {
        x: -0.75 * node_size,
        y: -0.75 * node_size,
        width: node_size * 1.5,
        height: node_size * 1.5,
        fill: nodeColor(d.t, colors),
        stroke: 'black',
        class: 'selectable',
      })
      g.appendChild(rect)
      d._selectables.push(rect)
    }

    const lbl = labelFor(d)
    if (d.phase !== '' || lbl !== undefined) {
      const text = svgEl('text', {
        y: 0.7 * node_size + 14,
        'text-anchor': 'middle',
        'font-size': '12px',
        'font-family': 'monospace',
        fill: '#00d',
        style: 'pointer-events: none; user-select: none;',
      })
      text.textContent = lbl !== undefined ? lbl : d.phase
      g.appendChild(text)
    }

    if (show_labels) {
      const text = svgEl('text', {
        y: -0.7 * node_size - 8,
        'text-anchor': 'middle',
        'font-size': '10px',
        'font-family': 'monospace',
        fill: '#999',
        style: 'pointer-events: none; user-select: none;',
      })
      text.textContent = d.name
      g.appendChild(text)
    }

    if (d.vdata.length > 0) {
      const text = svgEl('text', {
        y: -0.7 * node_size - 14 - 10 * d.vdata.length,
        'text-anchor': 'middle',
        'font-size': '8px',
        'font-family': 'monospace',
        fill: '#c66',
        style: 'pointer-events: none; user-select: none;',
      })
      for (const entry of d.vdata) {
        const tspan = svgEl('tspan', { x: '0', dy: '1.2em' })
        tspan.textContent = entry.join(': ')
        text.appendChild(tspan)
      }
      g.appendChild(text)
    }
  }

  if (scalar_str !== '') {
    const text = svgEl('text', { x: 60, y: 40, 'text-anchor': 'middle' })
    text.textContent = scalar_str
    svg.appendChild(text)
  }

  function nonHboxNeighbours(d: LiveNode): LiveNode[] {
    return d.nhd.filter(n => n.t !== 3)
  }

  function computeHboxPosition(d: LiveNode): { x: number; y: number } | null {
    const info = getHboxChainInfo(d)
    if (!info) return null
    const { endpointA: a, endpointB: b } = info
    const t = d.lineParam ?? 0.5
    return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
  }

  function updateHboxes(): void {
    if (!auto_hbox) return
    const occupied: Record<string, true> = {}
    for (const d of graph.nodes) {
      if (d.t !== 3 || !d._group) continue
      const pos = computeHboxPosition(d)
      if (pos) {
        d.x = pos.x
        d.y = pos.y
      } else {
        const nhd = nonHboxNeighbours(d)
        const offset = 0.25 * scale
        if (nhd.length > 0) {
          let x = 0
          let y = 0
          for (const n of nhd) {
            x += n.x
            y += n.y
          }
          x = x / nhd.length + offset
          y = y / nhd.length - offset
          while (occupied[`${x},${y}`]) x += offset
          d.x = x
          d.y = y
          occupied[`${x},${y}`] = true
        }
      }
      d._group.setAttribute('transform', `translate(${d.x},${d.y})`)
    }
  }

  updateHboxes()
  updateBoxes()

  function linkCurve(d: LiveLink): string {
    const { x: x1, y: y1 } = d.source
    const { x: x2, y: y2 } = d.target
    if (x1 === x2 && y1 === y2 && d.num_parallel === 1) {
      const cx1 = x1 - 40,
        cy1 = y1 - 40,
        cx2 = x1 + 40,
        cy2 = y1 - 40
      return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`
    }
    if (x1 === x2 && y1 === y2) {
      const pos = d.index + 1
      const cx1 = x1 - 20 - pos * 10
      const cy1 = y1 - 20 - pos * 10
      const cx2 = x1 + 20 + pos * 10
      const cy2 = y1 - 20 - pos * 10
      return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`
    }
    if (d.num_parallel === 1) return `M ${x1} ${y1} L ${x2} ${y2}`
    const dx = x2 - x1,
      dy = y2 - y1
    const midx = 0.5 * (x1 + x2),
      midy = 0.5 * (y1 + y2)
    const pos = d.index / (d.num_parallel - 1) - 0.5
    const cx = midx - pos * dy
    const cy = midy + pos * dx
    return `M ${x1} ${y1} Q ${cx} ${cy}, ${x2} ${y2}`
  }

  function webCurve(d: LiveGraph['pauli_web'][number]): string {
    const x1 = d.source.x
    const y1 = d.source.y
    const x2 = (x1 + d.target.x) / 2
    const y2 = (y1 + d.target.y) / 2
    return `M ${x1} ${y1} L ${x2} ${y2}`
  }

  for (const l of graph.links) l._el?.setAttribute('d', linkCurve(l))
  for (const w of graph.pauli_web) w._el?.setAttribute('d', webCurve(w))

  function applyStyleToSelectables(n: LiveNode): void {
    const style = nodeStyle(n.selected)
    for (const el of n._selectables) el.setAttribute('style', style)
  }

  // -- Drag: mousedown on a node group, mousemove drags all selected nodes. --
  for (const d of graph.nodes) {
    if (!d._group) continue
    d._group.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return
      const shift = e.shiftKey || e.metaKey
      if (shift) {
        d.selected = !d.selected
        applyStyleToSelectables(d)
        e.stopImmediatePropagation()
      } else if (!d.selected) {
        for (const n of graph.nodes) {
          n.selected = n === d
          applyStyleToSelectables(n)
        }
      }
      // Start drag from any mousedown that reaches here (matches d3.drag).
      let lastX = e.clientX
      let lastY = e.clientY
      const onMove = (me: MouseEvent) => {
        const dx = me.clientX - lastX
        const dy = me.clientY - lastY
        lastX = me.clientX
        lastY = me.clientY
        dragSelected(dx, dy)
      }
      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    })
  }

  function dragSelected(dx: number, dy: number): void {
    for (const n of graph.nodes) {
      if (!n.selected || !n._group) continue
      if (n.t === 3 && auto_hbox) {
        const info = getHboxChainInfo(n)
        if (info) {
          const { endpointA: a, endpointB: b } = info
          const ex = b.x - a.x,
            ey = b.y - a.y
          const lenSq = ex * ex + ey * ey
          if (lenSq > 0.001) {
            const dParam = (dx * ex + dy * ey) / lenSq
            const newParam = (n.lineParam ?? 0.5) + dParam
            let minParam = hboxMargin,
              maxParam = 1 - hboxMargin
            const idx = info.index
            if (idx > 0) minParam = (info.hboxes[idx - 1].lineParam ?? 0) + hboxMargin
            if (idx < info.hboxes.length - 1) {
              maxParam = (info.hboxes[idx + 1].lineParam ?? 1) - hboxMargin
            }
            n.lineParam = Math.max(minParam, Math.min(maxParam, newParam))
          }
          const pos = computeHboxPosition(n)
          if (pos) {
            n.x = pos.x
            n.y = pos.y
          }
        }
      } else {
        n.x += dx
        n.y += dy
      }
      n._group.setAttribute('transform', `translate(${n.x},${n.y})`)
    }
    updateHboxes()
    updateBoxes()
    for (const l of graph.links) {
      if (
        l.source.selected ||
        l.target.selected ||
        (auto_hbox && (l.source.t === 3 || l.target.t === 3))
      ) {
        l._el?.setAttribute('d', linkCurve(l))
      }
    }
    for (const w of graph.pauli_web) {
      if (w.source.selected || w.target.selected) w._el?.setAttribute('d', webCurve(w))
    }
  }

  // -- Brush: click on empty canvas → drag out a selection rectangle. --
  brushLayer.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.button !== 0) return
    const shift = e.shiftKey || e.metaKey
    const svgRect = svg.getBoundingClientRect()
    const startX = e.clientX - svgRect.left
    const startY = e.clientY - svgRect.top
    for (const n of graph.nodes) {
      n.previouslySelected = shift && n.selected
      n.selected = n.previouslySelected
      applyStyleToSelectables(n)
    }
    const brushRect = svgEl('rect', {
      fill: 'rgba(100,140,255,0.15)',
      stroke: 'rgba(100,140,255,0.6)',
      'stroke-dasharray': '4 3',
      'pointer-events': 'none',
    })
    brushLayer.appendChild(brushRect)

    const onMove = (me: MouseEvent) => {
      const r = svg.getBoundingClientRect()
      const cx = Math.max(0, Math.min(width, me.clientX - r.left))
      const cy = Math.max(0, Math.min(height, me.clientY - r.top))
      const minX = Math.min(startX, cx),
        maxX = Math.max(startX, cx)
      const minY = Math.min(startY, cy),
        maxY = Math.max(startY, cy)
      setAttrs(brushRect, { x: minX, y: minY, width: maxX - minX, height: maxY - minY })
      for (const n of graph.nodes) {
        const inside = minX <= n.x && n.x < maxX && minY <= n.y && n.y < maxY
        n.selected = n.previouslySelected !== inside
        applyStyleToSelectables(n)
      }
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      brushRect.remove()
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  })
}
