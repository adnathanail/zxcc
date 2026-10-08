import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'vite-plus'
import { playwright } from 'vite-plus/test/browser-playwright'

// `vp pack` sets NODE_ENV itself, so a development build is asked for with a
// variable of its own.
const production = process.env.ZXCC_DEV !== 'true'
const analyze = process.env.ANALYZE === 'true'
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

// Storybook reads and rewrites a cache of its own while the stories run, which
// would otherwise count as the task modifying its own input.
const storybookCache = {
  input: [{ auto: true }, '!node_modules/.cache/**'],
  output: [{ auto: true }, '!node_modules/.cache/**'],
}

export default defineConfig({
  // Run with `vp run <name>`. Tasks are cached: a rerun whose inputs haven't
  // changed replays its output and restores the files it wrote. The scripts
  // left in package.json are the ones something else runs by name (Chromatic
  // runs `build-storybook`, npm runs `prepare`) or that never exit (`storybook`).
  // The tasks that only wrap a built-in exist for the caching, since a built-in
  // run directly isn't cached.
  run: {
    tasks: {
      build: 'vp pack',
      'build-dev': 'ZXCC_DEV=true vp pack',
      // Opens the visualiser in a browser, which a replay wouldn't.
      analyze: { command: 'ANALYZE=true vp pack', cache: false },
      watch: { command: 'ZXCC_DEV=true vp pack --watch', cache: false },
      lint: 'vp check',
      test: { command: 'vp test run', cache: storybookCache },
      coverage: {
        command: 'vp test run --coverage',
        // The report is an output; its scratch files are neither.
        cache: {
          input: [...storybookCache.input, '!coverage/**'],
          output: [...storybookCache.output, '!coverage/.tmp/**'],
        },
      },
      // Imports the built `./constants` entry from plain Node; writes nothing
      // worth restoring.
      'test-node-entry': {
        command: 'node scripts/check-node-entry.mjs',
        dependsOn: ['build'],
        cache: { output: [] },
      },
    },
  },
  pack: [
    // The browser bundle: every element, with lit inlined so the package has
    // no runtime dependencies, and the type declarations for the whole API.
    {
      entry: { 'index.bundle': 'src/index.ts' },
      platform: 'browser',
      target: 'es2022',
      // lit stays an import in the declarations, since consumers have it
      // installed as a dependency either way.
      deps: { alwaysBundle: [/.*/], onlyBundle: false, dts: { neverBundle: [/^lit/, /^@lit\//] } },
      define: {
        'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development'),
        __ZXCC_VERSION__: JSON.stringify(pkg.version),
      },
      minify: production,
      // Inline, so a development build writes the same files as a production one
      // and a cached build restoring over it leaves nothing behind.
      sourcemap: production ? false : 'inline',
      dts: true,
      // Both check the package as a whole (package.json and everything in
      // dist), so they run once, here.
      publint: true,
      attw: { profile: 'esm-only', level: 'error' },
      plugins: analyze
        ? [
            visualizer({
              filename: 'dist/stats.html',
              gzipSize: true,
              brotliSize: true,
              open: true,
            }),
          ]
        : [],
    },
    // `@adnathanail/zxcc/constants`, imported by build-time tooling in plain
    // Node. Built on its own so it shares no chunk with the bundle and loads
    // without a DOM.
    {
      entry: { constants: 'src/constants.ts' },
      platform: 'neutral',
      target: 'es2022',
      dts: true,
      clean: false,
    },
  ],
  test: {
    projects: [
      {
        extends: true,
        // Runs every story's play function. See
        // https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
        plugins: [
          storybookTest({ configDir: fileURLToPath(new URL('.storybook', import.meta.url)) }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/index.ts'],
    },
  },
  // Run by the pre-commit hook in `.vite-hooks/`, which `npm install` sets up.
  staged: {
    '*': 'vp check --fix',
  },
  fmt: {
    singleQuote: true,
    semi: false,
    printWidth: 100,
    trailingComma: 'all',
    arrowParens: 'avoid',
    sortImports: { newlinesBetween: false },
    // Leaves lit's html/svg/css templates alone: a newline added between the
    // children of an SVG <text> renders as a space.
    embeddedLanguageFormatting: 'off',
    sortPackageJson: false,
    ignorePatterns: ['**/*.md', 'package-lock.json'],
  },
  lint: {
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
    options: { typeAware: true, typeCheck: true },
    overrides: [
      {
        // Storybook instruments `expect` for its interactions panel, which types
        // every assertion as a promise nobody needs to await.
        files: ['stories/**'],
        rules: { 'typescript/no-floating-promises': 'off' },
      },
    ],
  },
})
