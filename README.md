# zxcc - ZX Calculus Components

[![CI](https://github.com/adnathanail/zxcc/actions/workflows/ci.yml/badge.svg)](https://github.com/adnathanail/zxcc/actions/workflows/ci.yml)
[![Lit](https://img.shields.io/badge/lit-%23324FFF.svg?style=flat&logo=lit&logoColor=white)](https://lit.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org)
[![prek](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/j178/prek/master/docs/assets/badge-v0.json)](https://github.com/j178/prek)
[![Storybook](https://img.shields.io/badge/Storybook-%23FF4785.svg?style=flat&logo=storybook&logoColor=white)](https://storybook.js.org)

Framework-agnostic web component for rendering [ZX-calculus](https://zxcalculus.com) diagrams.

| Example basic layout | Example algebraic layout |
| ----------------------- | ------------------ |
| ![Basic layout demo](img/basic_layout_demo.png) | ![Algebraic layout demo](img/algebraic_layout_demo.png) |

[Checkout the demo](https://main--6a7e12985acc92e6ec37bdaa.chromatic.com)

## Usage

```sh
npm install @adnathanail/zxcc
```

```html
<script type="module" src="./node_modules/@adnathanail/zxcc/dist/index.bundle.js"></script>

<zx-diagram id="d"></zx-diagram>

<script type="module">
  document.getElementById('d').diagram = {
    nodes: [
      { id: 0, type: 'input',  ioId: 0 },
      { id: 1, type: 'spider', color: 'Z', phase: 'π/2' },
      { id: 2, type: 'output', ioId: 0 },
    ],
    edges: [
      { src: 0, tgt: 1 },
      { src: 1, tgt: 2 },
    ],
  }
</script>
```

`diagram` is a JS property, not an attribute — set it via a DOM reference so the object round-trips without JSON coercion.

Assign a new object to change the diagram; layout runs when the property's identity changes, so mutating the object already assigned paints nothing new. If you must mutate in place, call `el.refresh()` afterwards. Note that either way the re-layout resets the drawing: dragged nodes return to their laid-out positions and the selection is cleared.

## Diagram shape

```ts
interface DiagramData {
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  boxes?: { kind: 'stack' | 'compose'; nodeIds: number[] }[]
  labels?: [number, string][]  // node-id → phase-label override
  pauliWeb?: { src: number; tgt: number; kind: 'X' | 'Y' | 'Z' | 'I' }[]
  scalar?: string        // global scalar, drawn below the diagram
}

interface DiagramNode {
  id: number
  type: 'spider' | 'input' | 'output' | 'hadamard' | 'wire'
      | 'w-input' | 'w-output' | 'z-box'
  color?: 'Z' | 'X'      // spider only
  phase?: string         // pre-formatted (e.g. "π/2", "-π/4")
  ioId?: number          // input/output index
  col?: number           // optional pre-computed column
  qubit?: number         // optional pre-computed qubit row
  ground?: boolean       // draws a ground symbol below the node
  vdata?: [string, unknown][]  // annotations drawn above the node
}

interface DiagramEdge {
  src: number
  tgt: number
  kind?: 'simple' | 'hadamard' | 'w-io' | string   // default 'simple'; see edgeColors
}
```

If any node carries `col`, auto-layout is skipped and every node is expected to carry both `col` and `qubit`.
Otherwise a BFS from the inputs assigns rows and qubits.

An edge with `src === tgt` renders as a self-loop arc.

## Element attributes

These mirror the keyword arguments of pyzx's `draw_d3()` and control presentation
only — graph structure always lives in `diagram`.

| Attribute | Property | Default | Meaning |
| --- | --- | --- | --- |
| `show-labels` | `showLabels` | `false` | Draw each node's id above it, as `draw_d3(labels=True)` does. A bare `show-labels` turns it on. |
| `color-scheme` | `colorScheme` | `original` | One of `original`, `rgb`, `grayscale` — the palettes from `pyzx.utils`. |
| `scale` | `scale` | derived | Pixels per row/qubit. When set, the derived 20–50 clamp is bypassed. |
| `view-mode` | `viewMode` | `graph` | Which view to draw: `graph`, `hypergraph`, or both — `both-vertical` (stacked) or `both-horizontal` (side by side). See [Hypergraph view](#hypergraph-view). |
| — | `colors` | `null` | Full palette override (`Record<string, string>`), keyed as in `pyzx.utils.original_colors`. Wins over `color-scheme`. |
| — | `edgeColors` | `null` | Wire colours by edge kind, the three built-in ones or kinds of your own. Wins over both of the above, for the kinds named. |

```html
<zx-diagram show-labels color-scheme="grayscale" scale="40"></zx-diagram>
```

The palettes are exported too, if you want to build a variant:

```js
import { ORIGINAL_COLORS, RGB_COLORS, GRAYSCALE_COLORS, COLOR_SCHEMES } from '@adnathanail/zxcc'
```

### Wire colours and custom wire kinds

`edgeColors` maps edge kinds to colours — the kinds the diagram is written in, rather than pyzx's
`edge` / `Hedge` / `Xedge` palette entries. Only the kinds you name move; the rest stay on whatever
`color-scheme` or `colors` decided.

An edge's `kind` is **only** a colour: nothing in the layout or the geometry reads it. So it isn't
limited to the three built-in kinds — use any string you like and give it a colour here:

```js
const d = document.getElementById('d')
d.diagram = {
  nodes: [/* … */],
  edges: [
    { src: 0, tgt: 1, kind: 'control' },     // a kind of your own
    { src: 1, tgt: 2, kind: 'hadamard' },    // a built-in, recoloured
    { src: 2, tgt: 3 },                      // 'simple', left alone
  ],
}
d.edgeColors = { control: '#00aa55', hadamard: '#ff00aa' }
```

A kind you don't give a colour draws like a plain wire. Both views read a wire's colour from the same
lookup, so the hypergraph view's dot for a wire always comes out the colour of the wire itself.

## Hypergraph view

Set `view-mode="hypergraph"` (or the `viewMode` property) to draw the diagram's hypergraph dual
instead of the diagram — the roles of wires and spiders swap. Every ZX edge becomes a node (a
*wire*), drawn as a dot; every non-boundary ZX node becomes a *hyperedge*, drawn as a blob enclosing
the dots of the wires incident to it. Boundaries aren't hyperedges, they're just the loose end of a
wire.

```html
<zx-diagram id="d" view-mode="hypergraph"></zx-diagram>
```

`view-mode="both-vertical"` draws the pair with the diagram above its dual, and
`view-mode="both-horizontal"` puts them side by side, the diagram on the left; each is in its own
scroll container either way. The dual is drawn 1.6× roomier than the diagram it comes from — it has
twice the marks at half the spacing — so in these modes the diagram is laid out at that same scale,
and the two come out the same size with each dot on the same coordinates as the midpoint of the wire
it stands for: directly under it when stacked, level with it when side by side. Dragging stays local
to a view, but the **selection is shared**, since the same thing has a counterpart in each picture:

| Select this | …and this comes out selected |
| --- | --- |
| a spider or Hadamard in the diagram | the blob standing for it, with every dot it holds ringed |
| an input or output in the diagram | the dot of the wire it hangs off — a boundary is no hyperedge, so it has no blob |
| a blob in the dual (by clicking the blob) | the spider it stands for |
| a dot in the dual | the edge it stands for, cased in the selection colour — the wire keeps its own, so an H-edge still reads as one |

In the dual, what you pointed at is drawn **solid** and what follows from it **dashed** — press a dot and its
own ring is unbroken while the hyperedges holding that wire are outlined in dashes. It stops there: the other
wires those hyperedges hold get no mark, so the dot you pressed stays the one solid thing in its own answer.

```html
<zx-diagram id="d" view-mode="both-vertical"></zx-diagram>
<zx-diagram id="e" view-mode="both-horizontal"></zx-diagram>
```

Only Z/X spiders, I/O, and Hadamards are supported in this view, other node types will be rejected.

The conversion is also available standalone:

```js
import { toHypergraph } from '@adnathanail/zxcc'

const hg = toHypergraph(diagram)  // { wires, hyperedges }
```

## Development

Install npm dependencies:

```sh
npm install
```

Set up pre-commit hooks ([install prek](https://github.com/j178/prek) first):

```
prek --install
```

### Demo

To view the Storybook example usages, and an interactive Playground story with controls:

```sh
npm install
npm run storybook
```

### Testing

You can run tests from inside the Storybook web interface.
If you want to run them via the terminal:

```sh
npm run test
```

And to run with coverage:

```sh
npm run coverage
```

Then open `coverage/index.html` in a browser.

### Building from source

```sh
npm run build       # tsc → dist/, then rollup bundles to dist/index.bundle.js
npm run watch       # rollup --watch (rerun tsc manually on .ts changes)
```

The bundle is self-contained with no runtime dependencies.

### Analyzing bundle composition

```sh
npm run analyze
```