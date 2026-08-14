import { readFileSync } from 'node:fs'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import terser from '@rollup/plugin-terser'
import { visualizer } from 'rollup-plugin-visualizer'

const production = process.env.NODE_ENV === 'production'
const analyze = process.env.ANALYZE === 'true'
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

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
    resolve({ browser: true }),
    replace({
      preventAssignment: true,
      'typeof window': JSON.stringify('object'),
      'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development'),
      __ZXCC_VERSION__: JSON.stringify(pkg.version),
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
