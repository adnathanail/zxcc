# Vite+ ideas

Features of [Vite+](https://viteplus.dev) (`vp`) that this repository could adopt, roughly in order of
value for effort.

## 1. CI on `voidzero-dev/setup-vp`

`setup-vp` replaces `actions/setup-node` and `npm ci`. It installs `vp`, Node and the package
manager, and with `cache: true` caches dependencies. Combined with the task cache in `run.tasks`,
CI can skip a build whose inputs haven't changed (see `guide/github-actions-cache.md`).

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

## 2. Pin Node with `vp env pin`

`vp env pin` records the project's Node version in the repository. Locally, `vp` switches to it
automatically, and `setup-vp` reads the same version, so development and CI run on the same Node.
`engines.node` in `package.json` stays as it is, since it describes what consumers need.

## 3. Type-check stories in `vp check`

`vp check` type-checks only what `tsconfig.json` covers, which is `src/`. `stories/` is checked
separately by `tsc -p tsconfig.stories.json` in the `lint` task. If `vp check` can be pointed at the
stories config too, the `lint` task becomes just `vp check` and `typescript` may no longer need to be
a direct dependency. It is unconfirmed how tsgolint handles a second tsconfig, so this needs trying.
