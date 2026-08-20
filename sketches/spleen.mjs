// Emits a standalone spleen.html drawn with zxcc's own marks: pyzx original
// palette, the viewer's shapes and text slots, a Pauli-web strand, a scalar
// strip and the attribution badge.
// Run it with `node sketches/spleen.mjs`, then open `sketches/spleen.html`.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const W = 700
const H = 520
const SIZE = 8 // scene.nodeSize at scale 40

const C = {
  edge: '#000000',
  Hedge: '#0088ff',
  Xedge: '#999999',
  boundary: '#000000',
  X: '#ff8888',
  Z: '#ccffcc',
  H: '#ffff66',
  Xdark: '#ff8888',
  Zdark: '#99dd99',
  I: '#dddddd',
}
const PHASE_FILL = '#00d'
const LABEL_FILL = '#999'

// id: [kind, x, y, label, phase, labelAnchor]. The anchor moves a label off
// the default slot above the node, for the few that would otherwise land on a
// wire: 'below', 'left', 'right'.
const nodes = {
  // capsule — a closed ring, alternating Z and X. Long axis running top to
  // bottom, notched on the superior border (n2) and cut deeply inwards on the
  // medial one, where the hilum sits (n6).
  n1: ['z', 222, 70],
  n2: ['x', 262, 104, 'notch', '', 'right'],
  n3: ['z', 296, 78],
  n4: ['x', 338, 132],
  n5: ['z', 352, 192],
  n6: ['x', 286, 236, 'hilum', '', 'left-up'],
  n7: ['z', 352, 292],
  n8: ['x', 348, 356],
  n9: ['z', 316, 412],
  n10: ['x', 262, 446, '', 'π'],
  n11: ['z', 204, 444],
  n12: ['x', 156, 410],
  n13: ['z', 128, 356],
  n14: ['x', 116, 292],
  n15: ['z', 118, 216, 'capsule', '', 'left'],
  n16: ['x', 152, 132],

  // the vessels, as boundaries, leaving through the mouth of the hilar notch
  b1: ['boundary', 596, 146, 'splenic artery'],
  b2: ['boundary', 620, 238, 'splenic vein'],
  b3: ['boundary', 596, 332, 'efferent lymphatic', '', 'below'],

  // white pulp, hung off the trabecular artery
  hb: ['h', 238, 240],
  f1: ['z', 214, 168, 'white pulp'],
  f2: ['z', 176, 244, '', 'π/2'],
  f3: ['z', 206, 334, '', 'π/4'],

  // red pulp
  r1: ['x', 158, 178, '', 'π'],
  r2: ['x', 144, 268],
  r3: ['x', 162, 350],
  r4: ['x', 226, 396],
  r5: ['x', 268, 340, 'red pulp', '', 'right'],
  r6: ['x', 262, 158],

  // venous sinuses, draining back to the hilum
  v1: ['z', 258, 290],
  v2: ['z', 256, 194],
}

const ring = 'n1 n2 n3 n4 n5 n6 n7 n8 n9 n10 n11 n12 n13 n14 n15 n16'.split(' ')
const ringEdges = ring.map((id, i) => [id, ring[(i + 1) % ring.length], 'simple'])

const edges = [
  ...ringEdges,

  // vessels at the hilum: artery in on a Hadamard wire, vein out on a plain
  // one, lymphatic on the grey W-io wire
  ['b1', 'n6', 'hadamard'],
  ['n6', 'b2', 'simple'],
  ['n6', 'b3', 'w-io'],

  // arterial tree — trabecular artery to the central arterioles
  ['n6', 'hb', 'hadamard'],
  ['hb', 'f1', 'hadamard'],
  ['hb', 'f2', 'hadamard'],
  ['hb', 'f3', 'hadamard'],

  // marginal zone: white pulp opening into red pulp
  ['f1', 'r6', 'simple'],
  ['f1', 'r1', 'simple'],
  ['f2', 'r1', 'simple'],
  ['f2', 'r2', 'simple'],
  ['f3', 'r3', 'simple'],
  ['f3', 'r5', 'simple'],

  // red pulp cords
  ['r1', 'r2', 'simple'],
  ['r2', 'r3', 'simple'],
  ['r3', 'r4', 'simple'],
  ['r4', 'r5', 'simple'],

  // and its attachments to the capsule
  ['r1', 'n16', 'simple'],
  ['r1', 'n15', 'simple'],
  ['r2', 'n14', 'simple'],
  ['r3', 'n13', 'simple'],
  ['r3', 'n12', 'simple'],
  ['r4', 'n11', 'simple'],
  ['r4', 'n10', 'simple'],
  ['r5', 'n9', 'simple'],
  ['r6', 'n4', 'simple'],
  ['r6', 'n2', 'simple'],

  // venous return — inwards of the hilum, so the mouth of the notch stays
  // clear for the vessels
  ['r6', 'v2', 'simple'],
  ['v2', 'n6', 'simple'],
  ['r5', 'v1', 'simple'],
  ['v1', 'n6', 'simple'],
]

// Pauli webs: a grey identity strand around the capsule (fibrous tissue) and a
// red X strand along the red pulp cords.
const webs = [
  ...ringEdges.map(([a, b]) => [a, b, 'I']),
  ...['r1 r2', 'r2 r3', 'r3 r4', 'r4 r5'].map(p => [...p.split(' '), 'X']),
]

const EDGE_COLOR = { simple: C.edge, hadamard: C.Hedge, 'w-io': C.Xedge }
const WEB_COLOR = { I: C.I, X: C.Xdark, Z: C.Zdark }
const NODE_FILL = { z: C.Z, x: C.X, h: C.H, boundary: C.boundary }

const at = id => {
  const [, x, y] = nodes[id]
  return [x, y]
}

const linkPaths = edges
  .map(([a, b, kind]) => {
    const [x1, y1] = at(a)
    const [x2, y2] = at(b)
    return `      <path d="M ${x1} ${y1} L ${x2} ${y2}" stroke="${EDGE_COLOR[kind]}" fill="transparent" style="stroke-width: 1.5px" />`
  })
  .join('\n')

// A strand is a half-edge, source to midpoint, exactly as `webPath` draws one.
const webPaths = webs
  .flatMap(([a, b, kind]) => {
    const [x1, y1] = at(a)
    const [x2, y2] = at(b)
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2
    return [
      [x1, y1, mx, my, kind],
      [x2, y2, mx, my, kind],
    ]
  })
  .map(
    ([x1, y1, x2, y2, kind]) =>
      `      <path d="M ${x1} ${y1} L ${x2} ${y2}" stroke="${WEB_COLOR[kind]}" fill="transparent" style="stroke-width: 7px" />`,
  )
  .join('\n')

const shape = kind => {
  if (kind === 'h')
    return `<rect x="${-0.75 * SIZE}" y="${-0.75 * SIZE}" width="${1.5 * SIZE}" height="${1.5 * SIZE}" fill="${NODE_FILL.h}" stroke="black" style="stroke-width: 1.5px" />`
  const r = kind === 'boundary' ? 0.5 * SIZE : SIZE
  return `<circle r="${r}" fill="${NODE_FILL[kind]}" stroke="black" style="stroke-width: 1.5px" />`
}

// The label slot is the viewer's — 10px monospace grey, just above the node.
// Anywhere it would land on a wire it swings to another side of the node
// instead, keeping the same clearance.
const LABEL_SLOT = {
  above: { x: 0, y: -0.7 * SIZE - 8, anchor: 'middle' },
  below: { x: 0, y: 0.7 * SIZE + 18, anchor: 'middle' },
  left: { x: -0.7 * SIZE - 6, y: 4, anchor: 'end' },
  'left-up': { x: -0.7 * SIZE - 6, y: -8, anchor: 'end' },
  right: { x: 0.7 * SIZE + 6, y: 4, anchor: 'start' },
}

const nodeGroups = Object.entries(nodes)
  .map(([id, [kind, x, y, label, phase, slot = 'above']]) => {
    const parts = [`        ${shape(kind)}`]
    if (phase)
      parts.push(
        `        <text y="${0.7 * SIZE + 14}" text-anchor="middle" font-size="12px" font-family="monospace" fill="${PHASE_FILL}">${phase}</text>`,
      )
    if (label) {
      const s = LABEL_SLOT[slot]
      parts.push(
        `        <text x="${s.x}" y="${s.y}" text-anchor="${s.anchor}" font-size="10px" font-family="monospace" fill="${LABEL_FILL}">${label}</text>`,
      )
    }
    return `      <g data-node="${id}" transform="translate(${x},${y})">\n${parts.join('\n')}\n      </g>`
  })
  .join('\n')

const html = `<!doctype html>
<meta charset="utf-8" />
<title>Spleen, in ZX</title>
<style>
  body {
    margin: 0;
    padding: 2rem;
    background: white;
    font: 14px system-ui, sans-serif;
    color: #333;
  }
  h1 { font-size: 1.1rem; font-weight: 600; margin: 0 0 0.25rem; }
  p.sub { margin: 0 0 1.25rem; color: #666; }
  svg { display: block; background-color: #fcfcfd; }
  .attribution text { font: 11px system-ui, sans-serif; fill: #333; user-select: none; }
  .attribution rect { fill: rgba(226, 227, 229, 0.5); }
  .attribution a tspan { fill: #0366d6; }
  .attribution a:hover tspan { text-decoration: underline; }
  ul.key { list-style: none; padding: 0; margin: 1.25rem 0 0; max-width: ${W}px; columns: 2; }
  ul.key li { margin: 0 0 0.4rem; break-inside: avoid; }
  ul.key b { font-weight: 600; }
  .swatch {
    display: inline-block; width: 0.75rem; height: 0.75rem; margin-right: 0.4rem;
    border: 1.5px solid black; vertical-align: -0.1rem;
  }
  .swatch.round { border-radius: 50%; }
  .wire {
    display: inline-block; width: 0.9rem; height: 0; margin-right: 0.4rem;
    border-top: 1.5px solid black; vertical-align: 0.25rem;
  }
</style>

<h1>Spleen, in ZX</h1>
<p class="sub">An organ drawn with zxcc's marks — pyzx's original palette, the viewer's shapes, phase and label slots, and a Pauli web.</p>

<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <g class="web">
${webPaths}
  </g>

  <g class="link">
${linkPaths}
  </g>

  <g class="node">
${nodeGroups}
  </g>

  <text x="${W / 2}" y="${H - 20}" text-anchor="middle" font-family="monospace"><tspan fill="${LABEL_FILL}">×</tspan><tspan dx="0.4em">2√2</tspan></text>

  <g class="attribution">
    <rect></rect>
    <text x="${W - 3}" y="${H - 4}" text-anchor="end"><tspan>❤️</tspan><a href="https://github.com/adnathanail/zxcc" target="_blank" rel="noopener noreferrer"><tspan dx="3">zxcc</tspan></a></text>
  </g>
</svg>

<ul class="key">
  <li><span class="swatch round" style="background:${C.Z}"></span><b>Z spider</b> — white pulp: follicles, PALS, venous sinuses</li>
  <li><span class="swatch round" style="background:${C.X}"></span><b>X spider</b> — red pulp cords, and the capsule's own ring</li>
  <li><span class="swatch" style="background:${C.H}"></span><b>H box</b> — a trabecula, carrying the artery inwards</li>
  <li><span class="swatch round" style="background:${C.boundary};width:0.5rem;height:0.5rem;vertical-align:0"></span><b>Boundary</b> — a vessel leaving the drawing at the hilum</li>
  <li><span class="wire" style="border-color:${C.Hedge}"></span><b>Hadamard wire</b> — arterial: splenic to trabecular to central</li>
  <li><span class="wire"></span><b>Plain wire</b> — venous return and the capsule</li>
  <li><span class="wire" style="border-color:${C.Xedge}"></span><b>W-io wire</b> — the efferent lymphatic</li>
  <li><span class="wire" style="border-top-width:5px;border-color:${C.I}"></span><b>Pauli web</b> — grey for the fibrous capsule, red along the cords</li>
</ul>

<script>
  // The chip is sized around the laid-out text and the group nudged into the
  // corner, the same two steps placeAttribution() takes in the library.
  const g = document.querySelector('.attribution')
  const box = g.querySelector('text').getBBox()
  const pad = 3
  const [x, y] = [box.x - pad, box.y - pad]
  const [w, h] = [box.width + 2 * pad, box.height + 2 * pad]
  Object.entries({ x, y, width: w, height: h }).forEach(([k, v]) =>
    g.querySelector('rect').setAttribute(k, v),
  )
  g.setAttribute('transform', \`translate(\${${W} - (x + w)},\${${H} - (y + h)})\`)
</script>
`

writeFileSync(process.argv[2] ?? fileURLToPath(new URL('spleen.html', import.meta.url)), html)
