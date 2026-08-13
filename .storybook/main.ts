import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { StorybookConfig } from '@storybook/web-components-vite'
import type { Plugin } from 'vite'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SRC = path.resolve(__dirname, '..', 'src')

// Mirrors the `rawAssets` plugin in rollup.config.js: turns relative .js
// imports from src/ into raw-string default exports so zxViewer.js can be
// eval'd by zxDiagram.ts without being parsed as an ES module.
const rawSrcJsPlugin: Plugin = {
  name: 'raw-src-js',
  enforce: 'pre',
  resolveId(id, importer) {
    if (!importer) return null
    if (!id.endsWith('.js')) return null
    if (!id.startsWith('./') && !id.startsWith('../')) return null
    const resolved = path.resolve(path.dirname(importer), id)
    if (!resolved.startsWith(SRC + path.sep)) return null
    return resolved
  },
  load(id) {
    if (id.startsWith(SRC + path.sep) && id.endsWith('.js')) {
      return `export default ${JSON.stringify(readFileSync(id, 'utf8'))};`
    }
    return null
  },
}

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.ts'],

  framework: {
    name: '@storybook/web-components-vite',
    options: {},
  },

  async viteFinal(viteConfig) {
    viteConfig.plugins = [...(viteConfig.plugins ?? []), rawSrcJsPlugin]
    return viteConfig
  },
}

export default config
