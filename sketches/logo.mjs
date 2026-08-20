// Emits the SpLean mark from the same definitions as the plate, with the text,
// the scalar and the badge left off and the vessels cut back to stubs.
//
// Three assets, because one drawing cannot hold up across the whole size range:
//   logo.svg        the whole organ, tight to its marks, for 128px and up
//   logo-mark.svg   the sparse capsule, the trabecula and the three vessels,
//                   in a square box, with the strokes weighted up for 48px
//   logo-glyph.svg  sparser still, for favicon sizes
// plus logo.html, which puts all three at every size on light and dark.
//
// Run it with `node sketches/logo.mjs`, then open `sketches/logo.html`.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CORE, drawing, GLYPH, layers, nodes, RING_GLYPH, RING_SPARSE, SIZE } from './spleenDrawing.mjs'

// The sizes each mark is shown at are the range it is meant for: the whole
// organ stops where its interior stops reading, and the two reduced marks
// start below where it does.
const SIZES = {
  full: [256, 128, 96],
  mark: [128, 96, 64, 48, 32],
  glyph: [96, 64, 48, 32, 16],
}

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
    parts,
    ratio: b.width / b.height,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}">\n${layers(parts)}\n</svg>\n`,
  }
}

/**
 * How much heavier than the plate each reduced mark is drawn — spiders and
 * stroke widths together. The plate's proportions are set for a 700px drawing,
 * where a spider is 3% of the width; a mark that has to hold at 32px wants a
 * bigger share of itself to be spider. These are the numbers to tweak, and
 * `ceiling()` below prints how far each can go.
 */
const SCALE = { mark: 2.4, glyph: 3.4 }

/** How much of a node's own size each shape reaches out from its centre: a
 *  spider its radius, a boundary half that, an H-box half its width. */
const REACH = { z: 1, x: 1, h: 0.75, boundary: 0.5 }

/** The scale at which a mark's closest two nodes meet, and which pair they
 *  are. Past it the drawing overlaps itself. Measured on the positions the
 *  mark is actually drawn at, since a stub moves its boundary well off the one
 *  in `nodes`. */
function ceiling(keep, positions) {
  let closest = { scale: Number.POSITIVE_INFINITY, pair: '' }
  for (const [i, a] of keep.entries())
    for (const b of keep.slice(i + 1)) {
      const [ax, ay] = positions.get(a)
      const [bx, by] = positions.get(b)
      const gap = Math.hypot(ax - bx, ay - by)
      const scale = gap / ((REACH[nodes[a][0]] + REACH[nodes[b][0]]) * SIZE)
      if (scale < closest.scale) closest = { scale, pair: `${a}–${b}` }
    }
  return closest
}

// The three vessels leave the hilum within 33° of each other, so how far out
// they run is what sets how far apart their dots land.
const full = svg(drawing({ text: false, stubs: 62 }))
const mark = svg(
  drawing({ ring: RING_SPARSE, keep: CORE, text: false, stubs: 140, scale: SCALE.mark }),
  { square: true },
)
// The glyph is what is left when every mark has to be worth a pixel: a capsule
// of eight spiders, the trabecula in the middle of it, and one vessel.
const glyph = svg(
  drawing({ ring: RING_GLYPH, keep: GLYPH, text: false, stubs: 140, scale: SCALE.glyph }),
  { square: true },
)

for (const [name, keep, parts] of [
  ['mark', CORE, mark.parts],
  ['glyph', GLYPH, glyph.parts],
]) {
  const { scale, pair } = ceiling(keep, parts.positions)
  console.log(`${name}: drawn at ${SCALE[name]}, ceiling ${scale.toFixed(2)} at ${pair}`)
}

const out = name => fileURLToPath(new URL(name, import.meta.url))
writeFileSync(out('logo.svg'), full.markup)
writeFileSync(out('logo-mark.svg'), mark.markup)
writeFileSync(out('logo-glyph.svg'), glyph.markup)

/** One row of a mark across the sizes it is meant for, over a background. */
const row = (label, sizes, { box, markup, ratio }, background, dark) => `
  <section class="${dark ? 'dark' : ''}" style="background:${background}">
    <h2>${label}</h2>
    <div class="row">
      ${sizes
        .map(
          s =>
            `<figure>${markup.replace('<svg ', `<svg width="${Math.round(s * ratio)}" height="${s}" `)}<figcaption>${s}px</figcaption></figure>`,
        )
        .join('\n      ')}
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
<p class="sub">The spleen diagram as a logo: same node positions, wires and Pauli webs as the plate, with the labels, phases, scalar and badge dropped, the vessels cut back to stubs at the hilum, and progressively less kept as the mark gets smaller.</p>

${row('Whole organ — logo.svg', SIZES.full, full, '#fcfcfd', false)}
${row('Whole organ, on dark', SIZES.full, full, '#1c1c1f', true)}
${row('Sparse mark — logo-mark.svg', SIZES.mark, mark, '#fcfcfd', false)}
${row('Sparse mark, on dark', SIZES.mark, mark, '#1c1c1f', true)}
${row('Glyph — logo-glyph.svg', SIZES.glyph, glyph, '#fcfcfd', false)}
${row('Glyph, on dark', SIZES.glyph, glyph, '#1c1c1f', true)}
`

writeFileSync(out('logo.html'), html)
