import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { StorybookConfig } from '@storybook/web-components-vite'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8')) as {
  version: string
}

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.ts'],

  framework: {
    name: '@storybook/web-components-vite',
    options: {},
  },

  async viteFinal(viteConfig) {
    viteConfig.define = {
      ...(viteConfig.define ?? {}),
      __ZXCC_VERSION__: JSON.stringify(pkg.version),
    }
    return viteConfig
  },

  addons: ['@storybook/addon-vitest']
}

export default config
