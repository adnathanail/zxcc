// Emits a standalone spleen.html: the labelled plate, with a scalar strip and
// the attribution badge, over a key to what each mark stands for.
// Run it with `node sketches/spleen.mjs`, then open `sketches/spleen.html`.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { C, drawing, LABEL_FILL, layers } from './spleenDrawing.mjs'

const W = 700
const H = 520

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
${layers(drawing())}

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
