# sketches

Drawings made *with* zxcc's marks rather than by it: standalone HTML/SVG, no
build step. Each script writes its output next to itself.

| Run | Writes |
| --- | --- |
| `node sketches/spleen.mjs` | `spleen.html` — the labelled plate, with a key |
| `node sketches/logo.mjs` | `logo.svg`, `logo-mark.svg`, `logo-glyph.svg`, and `logo.html` to compare them at size |
| `npm run build && node sketches/spleenElement.mjs` | `spleen-element.html` — the same plate as a `DiagramData`, drawn by `<zx-diagram>` itself |

That last one is the exception to all of the above: it needs the library built,
and it is the one output not committed. The page embeds `dist/index.bundle.js`
so that it opens from disk — the bundle is an ES module, which a `file:` page
cannot load by `src` — and a copy of the build checked in beside the source it
was built from would go quietly stale.

`spleenDrawing.mjs` holds the one set of definitions all three draw from — node
positions, wires, Pauli webs, and a `drawing()` that takes the knobs a logo
needs (drop the text, cut the vessels back to stubs, thin the capsule out, and
scale the strokes and spiders up so the mark survives being shrunk). The
element version reads the same table and projects it into the package's own
input shape instead of into markup.

The palette, shapes, text slots and web strands are copies of what
`src/colors.ts` and `src/graph/viewer.ts` paint, at `scale` 40. They are copies
on purpose: these are pictures that happen to look like the library's, not a
second implementation of it, and nothing here is imported by the package.
