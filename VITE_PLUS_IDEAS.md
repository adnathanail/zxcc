# Vite+ ideas

Features of [Vite+](https://viteplus.dev) (`vp`) that this repository could adopt, roughly in order of
value for effort.

## 1. Pin Node with `vp env pin`

`vp env pin` records the project's Node version in the repository. Locally, `vp` switches to it
automatically, and `setup-vp` reads the same version, so development and CI run on the same Node.
`engines.node` in `package.json` stays as it is, since it describes what consumers need. Once the
version is pinned, the `node-version: '24'` input to `setup-vp` in `.github/workflows/ci.yml` can go.

## 2. Type-check stories in `vp check`

`vp check` type-checks only what `tsconfig.json` covers, which is `src/`. `stories/` is checked
separately by `tsc -p tsconfig.stories.json` in the `lint` task. If `vp check` can be pointed at the
stories config too, the `lint` task becomes just `vp check` and `typescript` may no longer need to be
a direct dependency. It is unconfirmed how tsgolint handles a second tsconfig, so this needs trying.
