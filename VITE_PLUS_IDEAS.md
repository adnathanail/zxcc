# Vite+ ideas

Features of [Vite+](https://viteplus.dev) (`vp`) that this repository could adopt, roughly in order of
value for effort.

## 1. Cached tasks

Scripts defined as tasks in a `run` block in `vite.config.ts` are cached: `vp run build` replays its
output when none of its inputs have changed. `dependsOn` expresses ordering, such as
`test-node-entry` needing `build` first.

```ts
run: {
  tasks: {
    build: { command: 'vp pack', cache: { env: ['ZXCC_DEV', 'ANALYZE'] } },
    'test-node-entry': { command: 'node scripts/check-node-entry.mjs', dependsOn: ['build'] },
  },
},
```

A task name can come from `vite.config.ts` or `package.json`, not both, so each script moved into
`run.tasks` comes out of `package.json`. Most of the benefit arrives with item 2. See
`node_modules/vite-plus/docs/guide/run.md` and `guide/cache.md`.

## 2. CI on `voidzero-dev/setup-vp`

`setup-vp` replaces `actions/setup-node` and `npm ci`. It installs `vp`, Node and the package
manager, and with `cache: true` caches dependencies. Combined with the task cache from item 1, CI
can skip a build whose inputs haven't changed (see `guide/github-actions-cache.md`).

```yaml
- uses: voidzero-dev/setup-vp@v1.21.1
  with:
    cache: true
- run: vp run lint
- run: vp run build
- run: vp run test-node-entry
```

Pin an exact release; the `v1` tag no longer receives updates. This also moves CI onto a Node
version that Vitest 5 supports (`^22.18.0 || ^24.11.0 || >=26.0.0`), which matters if the tests ever
run in CI. The Chromatic step and the publish workflow's npm OIDC setup need checking after the
switch.

## 3. Pin Node with `vp env pin`

`vp env pin` records the project's Node version in the repository. Locally, `vp` switches to it
automatically, and `setup-vp` reads the same version, so development and CI run on the same Node.
`engines.node` in `package.json` stays as it is, since it describes what consumers need.

## 4. Type-check stories in `vp check`

`vp check` type-checks only what `tsconfig.json` covers, which is `src/`. `stories/` is checked
separately by `tsc -p tsconfig.stories.json` in `npm run lint`. If `vp check` can be pointed at the
stories config too, `npm run lint` becomes just `vp check` and `typescript` may no longer need to be
a direct dependency. It is unconfirmed how tsgolint handles a second tsconfig, so this needs trying.
