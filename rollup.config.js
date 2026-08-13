import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import terser from '@rollup/plugin-terser'
import { visualizer } from 'rollup-plugin-visualizer'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Imports src .js files (like zxViewer.js) as plain string modules so they can
// be embedded for eval(). Resolves paths from dist/ back to src/ since tsc
// compiles there but these files stay in src/.
const rawAssets = {
  name: 'raw-assets',
  resolveId(id, importer) {
    // Only intercept relative .js imports (bare specifiers like
    // 'lit/decorators.js' go to node resolution).
    if (id.endsWith('.js') && importer && (id.startsWith('./') || id.startsWith('../'))) {
      const srcImporter = importer.replace(
        `${path.sep}dist${path.sep}`,
        `${path.sep}src${path.sep}`,
      )
      const resolved = path.resolve(path.dirname(srcImporter), id)
      if (!resolved.includes(path.join(__dirname, 'src'))) return null
      return resolved
    }
  },
  load(id) {
    if (id.endsWith('.js') && id.includes(path.join(__dirname, 'src'))) {
      return `export default ${JSON.stringify(readFileSync(id, 'utf8'))};`
    }
  },
}

const production = process.env.NODE_ENV === 'production'
const analyze = process.env.ANALYZE === 'true'

export default {
  input: 'dist/index.js',
  output: {
    file: 'dist/index.bundle.js',
    format: 'es',
    sourcemap: production ? false : 'inline',
    intro: 'const global = window;',
  },
  // Silence "this rewritten to undefined" from tsc-emitted __decorate helper.
  context: 'globalThis',
  plugins: [
    rawAssets,
    resolve({ browser: true }),
    replace({
      preventAssignment: true,
      'typeof window': JSON.stringify('object'),
      'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development'),
    }),
    commonjs(),
    production && terser(),
    analyze &&
      visualizer({
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
        open: true,
      }),
  ],
}
