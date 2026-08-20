# sketches

Drawings made *with* zxcc's marks rather than by it: standalone HTML/SVG, no
build step, no dependency on the library. Each script writes its output next to
itself.

| Run | Writes |
| --- | --- |
| `node sketches/spleen.mjs` | `spleen.html` — the labelled plate, with a key |
| `node sketches/logo.mjs` | `logo.svg`, `logo-mark.svg`, `logo-glyph.svg`, and `logo.html` to compare them at size |

`spleenDrawing.mjs` holds the one set of definitions both draw from — node
positions, wires, Pauli webs, and a `drawing()` that takes the knobs a logo
needs (drop the text, cut the vessels back to stubs, thin the capsule out, and
scale the strokes and spiders up so the mark survives being shrunk).

The palette, shapes, text slots and web strands are copies of what
`src/colors.ts` and `src/graph/viewer.ts` paint, at `scale` 40. They are copies
on purpose: these are pictures that happen to look like the library's, not a
second implementation of it, and nothing here is imported by the package.
