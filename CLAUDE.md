# zxcc

Framework-agnostic `<zx-diagram>` web component for rendering ZX-calculus
diagrams. Built with Lit + D3 v5. See README.md for user-facing usage.

## File layout

- `src/zxDiagram.ts` — `ZxDiagramElement` (`LitElement`), the `<zx-diagram>`
  custom element. Owns rendering, error handling, and D3 mount.
- `src/zxRender.ts` — pure-TS layout: takes `DiagramData`, runs a BFS from
  the inputs to assign col/qubit, emits a D3-ready `{nodes, links}` object
  with per-node `t`/`phase` and per-link `index`/`num_parallel` for
  bezier arcs on parallel edges.
- `src/zxViewer.js` — vendored from pyzx's `zx_viewer.inline.js` with a
  fix for H-box edge redraw. Loaded as a raw string and `eval`'d with
  `d3` and `_settings_colors` injected into its scope (see `getShowGraph`
  in zxDiagram.ts). Do not import it as a normal ES module.
- `src/index.ts` — package entry, re-exports the element class and types.
- `src/stories/*.stories.ts` — Storybook (CSF3) stories used by
  `npm run storybook`. `.storybook/preview.ts` imports `src/zxDiagram`
  so the custom element registers before any story renders.

## Build

- `tsc` compiles `src/**/*.ts` to `dist/*.js` + `.d.ts`.
- Rollup then bundles `dist/index.js` → `dist/index.bundle.js`, inlining
  d3 + lit so the shipped bundle has zero runtime deps. The custom
  `rawAssets` plugin in `rollup.config.js` handles the `zxViewer.js`
  raw-string import — it only intercepts relative `.js` imports from
  `src/` (bare specifiers like `lit/decorators.js` go through node
  resolution).
- Package entry is `dist/index.bundle.js`; `dist/index.js` is the tsc
  intermediate (also shipped, but nothing imports it in practice).
- `context: 'globalThis'` in rollup config is required so tsc's emitted
  `__decorate` helper (used by Lit's `@customElement` etc.) doesn't get
  rewritten to `undefined && ...`.

## Conventions

- Lit decorators are on: `experimentalDecorators: true` and
  `useDefineForClassFields: false` in tsconfig. Use `@customElement`,
  `@property`, `@state`, and the `ref()` directive from
  `lit/directives/ref.js`.
- The element renders into shadow DOM (Lit's default). D3 mounts into
  the container inside the shadow root — this is fine because
  `zxViewer.js` has no `document.` or `window.` refs.
- `diagram` is an `{ attribute: false }` property, not an HTML attribute
  — it carries arbitrary objects.
- The element deliberately renders a single diagram. Layout of multiple
  panels (current vs. goal, side-by-side/stacked/hidden) lives in
  downstream consumers, not here.

## Testing

- `vitest` + `jsdom`. Tests use hoisted `vi.mock` for `d3` and
  `zxViewer.js` (the D3 stack is expensive and irrelevant for DOM tests).
- Custom-element registration is global and can't be reset between
  tests, so tests toggle mock behaviour via a hoisted control object
  rather than `resetModules` + re-import. See `src/__tests__/zxDiagram.test.ts`.

## Gotchas

- `phase` strings are pre-formatted (`π/2`, `-π/4`, `0`) — no parsing
  in `zxRender.ts`. Consumers do their own formatting.
- Default H-box phase is `π`, which renders no text (pyzx convention).
- Boxes are sorted largest-nodeIds-first so outer paint behind inner.
