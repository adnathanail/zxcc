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
  kind?: 'simple' | 'hadamard' | 'w-io'   // default 'simple'
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
| `show-labels` | `showLabels` | `true` | Draw each node's id above it. Set `show-labels="false"` to hide — a bare boolean attribute can't express "off" for a true-by-default property. |
| `color-scheme` | `colorScheme` | `original` | One of `original`, `rgb`, `grayscale` — the palettes from `pyzx.utils`. |
| `scale` | `scale` | derived | Pixels per row/qubit. When set, the derived 20–50 clamp is bypassed. |
| — | `colors` | `null` | Full palette override (`Record<string, string>`), keyed as in `pyzx.utils.original_colors`. Wins over `color-scheme`. |

```html
<zx-diagram show-labels="false" color-scheme="grayscale" scale="40"></zx-diagram>
```

The palettes are exported too, if you want to build a variant:

```js
import { ORIGINAL_COLORS, RGB_COLORS, GRAYSCALE_COLORS, COLOR_SCHEMES } from '@adnathanail/zxcc'
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