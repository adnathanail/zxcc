// Emits spleen-element.html: the same spleen, built as a `DiagramData` and
// handed to the real `<zx-diagram>` rather than drawn by hand.
//
// The sketch's node table is in pixels at a scale of 40, and layout() puts a
// node at `col * scale`, so dividing by that scale and setting `scale` back to
// 40 on the element reproduces the drawing the plate paints — the same
// positions, wires, webs and scalar, through the library's own layout and
// painter.
//
// The one thing that does not carry across is where text sits. A `DiagramNode`
// has a single text slot under the node, so the plate's grey labels ride in it
// alongside the phases and land wherever the viewer puts them.
//
// The page embeds `dist/index.bundle.js`, so it opens from disk with no server
// — a module script loaded by `src` would be blocked over `file:`. Build first:
//
//   npm run build && node sketches/spleenElement.mjs
//
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CORD_WEB, EXTRA_EDGES, nodes, RING } from './spleenDrawing.mjs'

/** Pixels per grid step, both to divide the sketch's positions by and to hand
 *  back to the element, which is what makes the two the same size. */
const SCALE = 40

const ids = Object.keys(nodes)
const id = name => ids.indexOf(name)

/** A spider carries its colour; an H-box is its own type. */
const SPIDER = { z: 'Z', x: 'X' }

/** Which way each vessel runs. Both draw as a boundary — the type is what the
 *  diagram says the wire is for, and the artery is the one flowing in. */
const IO = { b1: 'input', b2: 'output', b3: 'output' }

const ringEdges = RING.map((n, i) => [n, RING[(i + 1) % RING.length]])

const diagram = {
  nodes: ids.map(name => {
    const [kind, x, y, , phase] = nodes[name]
    const node = { id: id(name), type: 'spider', col: x / SCALE, qubit: y / SCALE }
    if (kind === 'boundary') node.type = IO[name]
    else if (kind === 'h') node.type = 'hadamard'
    else node.color = SPIDER[kind]
    if (phase) node.phase = phase
    return node
  }),

  edges: [
    ...ringEdges.map(([a, b]) => ({ src: id(a), tgt: id(b) })),
    ...EXTRA_EDGES.map(([a, b, kind]) => ({ src: id(a), tgt: id(b), kind })),
  ],

  // A strand per capsule wire and per red pulp cord. Each entry is drawn from
  // its `src` to the midpoint of the wire, so covering a wire takes the pair of
  // them — which is what `webPath` means by a strand being a half-edge.
  pauliWeb: [...ringEdges.map(e => [e, 'I']), ...CORD_WEB.map(e => [e, 'X'])].flatMap(
    ([[a, b], kind]) => [
      { src: id(a), tgt: id(b), kind },
      { src: id(b), tgt: id(a), kind },
    ],
  ),

  // The anatomy, in the one text slot a node has. `labels` overrides the phase,
  // and no node here carries both.
  labels: ids.filter(name => nodes[name][3]).map(name => [id(name), nodes[name][3]]),

  scalar: '2√2',
}

const bundle = fileURLToPath(new URL('../dist/index.bundle.js', import.meta.url))
let element
try {
  element = readFileSync(bundle, 'utf8')
} catch {
  console.error(`Missing ${bundle}\nRun \`npm run build\` first — the page embeds the bundle.`)
  process.exit(1)
}

const html = `<!doctype html>
<meta charset="utf-8" />
<title>Spleen, in ZX — through the element</title>
<style>
  body {
    margin: 0;
    padding: 2rem;
    background: white;
    font: 14px system-ui, sans-serif;
    color: #333;
  }
  h1 { font-size: 1.1rem; font-weight: 600; margin: 0 0 0.25rem; }
  p.sub { margin: 0 0 1.25rem; color: #666; max-width: 46rem; }
  zx-diagram { display: block; width: max-content; }
</style>

<h1>Spleen, in ZX — through the element</h1>
<p class="sub">The same spleen as <code>spleen.html</code>, but as a <code>DiagramData</code> handed to <code>&lt;zx-diagram&gt;</code>: the library lays it out and paints it. Positions are the sketch's own, divided by the scale and handed back, so the two come out the same size. A node has one text slot, so the anatomical labels ride in it beside the phases.</p>

<zx-diagram id="spleen"></zx-diagram>

<script type="module">
${element}
</script>

<script type="module">
  const el = document.getElementById('spleen')
  el.scale = ${SCALE}
  el.diagram = ${JSON.stringify(diagram)}
</script>
`

writeFileSync(
  process.argv[2] ?? fileURLToPath(new URL('spleen-element.html', import.meta.url)),
  html,
)
