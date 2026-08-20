// Emits the SpLean mark from the same definitions as the plate, with the text,
// the scalar and the badge left off and the vessels cut back to stubs.
//
// Two assets, because one drawing cannot hold up across the whole size range:
//   logo.svg       the whole organ, tight to its marks, for 128px and up
//   logo-mark.svg  the sparse capsule and the trabecula, in a square box,
//                  with the strokes weighted up to survive down to 32px
// plus logo.html, which puts both at every size on light and dark to compare.
//
// Run it with `node sketches/logo.mjs`, then open `sketches/logo.html`.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CORE, drawing, layers, RING_SPARSE } from './spleenDrawing.mjs'

const SIZES = [256, 128, 96, 64, 48, 32]

/** Grow a box to a square about its own centre, so a mark that is taller than
 *  it is wide keeps its margins when it is dropped into a square slot. */
function squared({ x, y, width, height }) {
  const side = Math.max(width, height)
  return { x: x - (side - width) / 2, y: y - (side - height) / 2, width: side, height: side }
}

function svg(parts, { square = false } = {}) {
  const b = square ? squared(parts.bounds) : parts.bounds
  const box = [b.x, b.y, b.width, b.height].map(n => Math.round(n * 100) / 100).join(' ')
  return {
    box,
    ratio: b.width / b.height,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}">\n${layers(parts)}\n</svg>\n`,
  }
}

// The three vessels leave the hilum within 33° of each other, so how far out
// they run is what sets how far apart their dots land.
const full = svg(drawing({ text: false, stubs: 62 }))
const mark = svg(
  drawing({ ring: RING_SPARSE, keep: CORE, text: false, stubs: 90, weight: 1.9, dots: 1.7 }),
  { square: true },
)
// Nothing carrying interior detail survives a favicon, so the glyph keeps only
// what the silhouette needs: the capsule, and the vessels that say the
// silhouette is a diagram.
const glyph = svg(
  drawing({
    ring: RING_SPARSE,
    keep: [...RING_SPARSE, 'b1', 'b2', 'b3'],
    text: false,
    stubs: 104,
    weight: 2.8,
    dots: 2.4,
  }),
  { square: true },
)

const out = name => fileURLToPath(new URL(name, import.meta.url))
writeFileSync(out('logo.svg'), full.markup)
writeFileSync(out('logo-mark.svg'), mark.markup)
writeFileSync(out('logo-glyph.svg'), glyph.markup)

/** One row of the mark at every size, over a given background. */
const row = (label, { box, markup, ratio }, background, dark) => `
  <section class="${dark ? 'dark' : ''}" style="background:${background}">
    <h2>${label}</h2>
    <div class="row">
      ${SIZES.map(
        s =>
          `<figure>${markup.replace('<svg ', `<svg width="${Math.round(s * ratio)}" height="${s}" `)}<figcaption>${s}px</figcaption></figure>`,
      ).join('\n      ')}
    </div>
    <p class="box">viewBox="${box}"</p>
  </section>`

const html = `<!doctype html>
<meta charset="utf-8" />
<title>SpLean mark</title>
<style>
  body {
    margin: 0;
    padding: 2rem;
    background: white;
    font: 14px system-ui, sans-serif;
    color: #333;
  }
  h1 { font-size: 1.1rem; font-weight: 600; margin: 0 0 0.25rem; }
  p.sub { margin: 0 0 1.5rem; color: #666; max-width: 46rem; }
  section { padding: 1.25rem; border-radius: 8px; margin: 0 0 1rem; }
  section.dark { color: #eee; }
  h2 { font-size: 0.8rem; font-weight: 600; text-transform: uppercase;
       letter-spacing: 0.06em; margin: 0 0 1rem; opacity: 0.7; }
  .row { display: flex; align-items: flex-end; gap: 1.5rem; flex-wrap: wrap; }
  figure { margin: 0; text-align: center; }
  figcaption { margin-top: 0.5rem; font-size: 11px; opacity: 0.6; }
  p.box { margin: 1rem 0 0; font: 11px monospace; opacity: 0.5; }
</style>

<h1>SpLean mark</h1>
<p class="sub">The spleen diagram as a logo: same node positions, wires and Pauli webs as the plate, with the labels, phases, scalar and badge dropped and the three vessels cut back to stubs at the hilum.</p>

${row('Whole organ — logo.svg', full, '#fcfcfd', false)}
${row('Whole organ, on dark', full, '#1c1c1f', true)}
${row('Sparse mark — logo-mark.svg', mark, '#fcfcfd', false)}
${row('Sparse mark, on dark', mark, '#1c1c1f', true)}
${row('Glyph — logo-glyph.svg', glyph, '#fcfcfd', false)}
${row('Glyph, on dark', glyph, '#1c1c1f', true)}
`

writeFileSync(out('logo.html'), html)
