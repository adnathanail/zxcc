# zxcc - ZX Calculus Components

[![CI](https://github.com/adnathanail/zxcc/actions/workflows/ci.yml/badge.svg)](https://github.com/adnathanail/zxcc/actions/workflows/ci.yml)
[![prek](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/j178/prek/master/docs/assets/badge-v0.json)](https://github.com/j178/prek)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org)

Framework-agnostic web component for rendering [ZX-calculus](https://zxcalculus.com) diagrams.
Ships as a `<zx-diagram>` custom element built with [Lit](https://lit.dev) and [D3](https://d3js.org) v5.

The rendering code is a TypeScript port of pyzx's diagram-construction plus a small BFS auto-layout, wrapping pyzx's `zx_viewer.inline.js` (vendored, lightly modified) for the actual SVG draw + drag interaction.

## Usage

```html
<script type="module" src="./node_modules/zxcc/dist/index.bundle.js"></script>

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
  edges: { src: number; tgt: number }[]
  boxes?: { kind: 'stack' | 'compose'; nodeIds: number[] }[]
  labels?: [number, string][]  // node-id → phase-label override
}

interface DiagramNode {
  id: number
  type: 'spider' | 'input' | 'output' | 'hadamard' | 'wire'
  color?: 'Z' | 'X'      // spider only
  phase?: string         // pre-formatted (e.g. "π/2", "-π/4")
  ioId?: number          // input/output index
  col?: number           // optional pre-computed column
  qubit?: number         // optional pre-computed qubit row
}
```

If any node carries `col`, auto-layout is skipped and every node is expected to carry both `col` and `qubit`.
Otherwise a BFS from the inputs assigns rows and qubits.

## Demo

Seven example diagrams (identity, Z spider with phase, Bell-state prep, spider fusion, parallel edges, symbolic label, error path) are in `demo/index.html`.

```sh
npm install
npm run build
npm run demo
```

Then open <http://127.0.0.1:8000/demo/>.
A static server is required because ES-module imports don't work over `file://`.

## Development

### Prek

[Install prek](https://github.com/j178/prek) and run
```
prek --install
```

### Building from source

```sh
npm install
npm run build       # tsc → dist/, then rollup bundles to dist/index.bundle.js
npm run watch       # rollup --watch (rerun tsc manually on .ts changes)
npm test            # vitest (jsdom + plain DOM)
```

The bundle is self-contained: d3 and lit are baked in, no runtime deps.
