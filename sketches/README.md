# sketches

Drawings made *with* zxcc's marks rather than by it: standalone HTML/SVG, no
build step, no dependency on the library. Each script writes its output next to
itself.

| Run | Writes |
| --- | --- |
| `node sketches/spleen.mjs` | `spleen.html` — the labelled plate, with a key |

`spleenDrawing.mjs` holds the definitions the plate draws from — node
positions, wires, Pauli webs — and `drawing()`, which turns them into the three
layers of SVG markup, in the same paint order `<zx-viewer>` uses.

The palette, shapes, text slots and web strands are copies of what
`src/colors.ts` and `src/graph/viewer.ts` paint, at `scale` 40. They are copies
on purpose: these are pictures that happen to look like the library's, not a
second implementation of it, and nothing here is imported by the package.
