# Vite+ ideas

Features of [Vite+](https://viteplus.dev) (`vp`) that this repository could adopt, roughly in order of
value for effort.

## 1. Type-check stories in `vp check`

`vp check` type-checks only what `tsconfig.json` covers, which is `src/`. `stories/` is checked
separately by `tsc -p tsconfig.stories.json` in the `lint` task. If `vp check` can be pointed at the
stories config too, the `lint` task becomes just `vp check` and `typescript` may no longer need to be
a direct dependency. It is unconfirmed how tsgolint handles a second tsconfig, so this needs trying.
