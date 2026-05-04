# Changelog

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
