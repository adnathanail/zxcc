// Guards `@adnathanail/zxcc/constants`, the DOM-free entry point.
//
// Build-time tooling — a static site generator validating a `view-mode`
// against `VIEW_MODES`, say — imports it from a plain Node process. Two things
// have to hold for that, and neither is visible from inside the package:
//
//   1. `package.json` has to map the `./constants` subpath. Without it Node
//      reports ERR_PACKAGE_PATH_NOT_EXPORTED, since a package that declares
//      `exports` exposes nothing else.
//   2. `src/constants.ts` has to import nothing. `dist/constants.js` is a tsc
//      intermediate, not a bundle, and tsc writes relative specifiers
//      extensionless (`from './colors'`); Node refuses to resolve those, so a
//      single import added to that file breaks every Node consumer. Nothing in
//      the package's own build would notice — the bundler resolves them fine.
//
// So this runs the real import the way a consumer would: through the exports
// map, in a separate Node process, with no DOM shim of any kind. The package is
// reached through a throwaway `node_modules` symlink rather than an install, so
// the exports map is exercised without a registry round-trip.
//
// Run after `npm run build`.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = dirname(dirname(fileURLToPath(import.meta.url)))

for (const built of ['dist/constants.js', 'dist/constants.d.ts']) {
  if (!existsSync(join(repo, built))) {
    console.error(`✗ ${built} is missing — run \`npm run build\` first.`)
    process.exit(1)
  }
}

// A consumer package that reaches zxcc as a bare specifier, so Node has to go
// through `exports` to find the subpath.
const consumer = mkdtempSync(join(tmpdir(), 'zxcc-node-entry-'))
try {
  writeFileSync(join(consumer, 'package.json'), '{ "type": "module" }\n')
  mkdirSync(join(consumer, 'node_modules', '@adnathanail'), { recursive: true })
  symlinkSync(repo, join(consumer, 'node_modules', '@adnathanail', 'zxcc'), 'dir')

  const source = `
    import assert from 'node:assert/strict'
    import { COLOR_SCHEMES, ORIGINAL_COLORS, VIEW_MODES } from '@adnathanail/zxcc/constants'

    // Nothing here may depend on a browser: the point of the entry point is
    // that it loads where there isn't one.
    assert.equal(typeof globalThis.window, 'undefined', 'a window leaked into the test process')
    assert.equal(typeof globalThis.customElements, 'undefined', 'a custom-element registry leaked in')

    assert.deepEqual([...VIEW_MODES], ['graph', 'hypergraph', 'both-vertical', 'both-horizontal'])
    assert.deepEqual(Object.keys(COLOR_SCHEMES), ['original', 'rgb', 'grayscale'])
    assert.equal(COLOR_SCHEMES.original, ORIGINAL_COLORS)
    assert.equal(ORIGINAL_COLORS.Z, '#ccffcc')
  `

  const run = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: consumer,
    encoding: 'utf8',
  })

  if (run.status !== 0) {
    console.error('✗ @adnathanail/zxcc/constants does not load in a bare Node process.')
    console.error(run.stderr || run.stdout)
    console.error(
      '\nIf this is ERR_MODULE_NOT_FOUND on a specifier like `./colors`, something in\n' +
        'src/constants.ts is importing again — that file has to import nothing.',
    )
    process.exit(1)
  }

  console.log('✓ @adnathanail/zxcc/constants loads in a bare Node process')
} finally {
  rmSync(consumer, { recursive: true, force: true })
}
