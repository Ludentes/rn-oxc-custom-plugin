# Changelog

## v0.1.0

Filename gates are now configurable via shared settings — drop-in support for non-monorepo layouts.

- New `settings["rn-expo"].appRoots` (string array) controls which path prefixes the rules treat as mobile-app source. Defaults to `["apps/mobile"]` (preserves prior behavior). For a flat layout where `app/` and `src/` sit at the repo root, set `["."]`. Multi-app monorepos can pass several roots, e.g. `["apps/mobile", "apps/driver"]`.
- Affected rules: `i18n-no-hardcoded-jsx-text`, `color-tokens-no-hex-literal-in-component`, `compat-no-es2023-array-methods`, `env-expo-public-prefix-only`, `storage-kv-store-key-prefix`, `power-short-interval-without-appstate`, `router-screen-conventions-default-export-required`. The `required-wrappers-gesture-handler-root` and `imports-flashlist-estimated-item-size` rules were already layout-agnostic and are unchanged.
- `isExpoRouterRouteFile(filename, appRoots?)` now accepts an optional roots array (defaults to `["apps/mobile"]`).
- New `src/util/paths.ts` exports the regex builders.
- No breaking changes for existing monorepo users.

## v0.0.3

Example config (`examples/.oxlintrc.json`) only — no rule changes.

- Switched off rules that produce high warning volume with low signal in idiomatic RN/Expo code: `react-perf/jsx-no-{new-array,new-function,new-object,jsx}-as-prop`, `react/no-array-index-key`, `no-await-in-loop`, `import/no-unassigned-import`, `react/style-prop-object`, `oxc/no-map-spread`, `promise/no-multiple-resolved`.
- Documented each in the new "Noise dampeners" section of `examples/README.md`.

## v0.0.2

- New rule `rn-expo/compat-no-es2023-array-methods` (error) — bans `.toSorted()`, `.toReversed()`, `.toSpliced()` in app source. Hermes support is uneven across RN/OEM builds; calls throw `TypeError: undefined is not a function` at runtime with no transpile fallback. Pair with `unicorn/no-array-sort: off` to avoid the conflicting "use toSorted" advice.

## v0.0.1

Initial extraction. 8 rules across 7 domains:

- `rn-expo/required-wrappers-gesture-handler-root`
- `rn-expo/i18n-no-hardcoded-jsx-text`
- `rn-expo/color-tokens-no-hex-literal-in-component`
- `rn-expo/power-short-interval-without-appstate`
- `rn-expo/storage-kv-store-key-prefix` (configurable via `prefix` option)
- `rn-expo/router-screen-conventions-default-export-required`
- `rn-expo/env-expo-public-prefix-only`
- `rn-expo/imports-flashlist-estimated-item-size`

Plus the operational best-practices catalog under [`docs/`](./docs).
