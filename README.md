# rn-oxc-custom-plugin

Custom [oxlint](https://oxc.rs) rules for React Native + Expo. Companion to the operational best-practices catalog under [`docs/`](./docs).

Built on the oxlint JS plugin alpha (March 2026, ESLint v9-compatible). Rules are also runnable under ESLint with no changes.

## Status

v0.1.0. 9 rules across 8 domains. Battle-tested on a production Android-primary RN/Expo app before extraction. Filename gates are configurable — works for both monorepo (`apps/mobile/`) and flat (repo-root `app/` + `src/`) layouts.

## Install

```bash
pnpm add -D rn-oxc-custom-plugin
```

In `.oxlintrc.json`:

```jsonc
{
  "jsPlugins": ["rn-oxc-custom-plugin"],
  "rules": {
    "rn-expo/required-wrappers-gesture-handler-root": "error",
    "rn-expo/i18n-no-hardcoded-jsx-text": "warn",
    "rn-expo/color-tokens-no-hex-literal-in-component": "warn",
    "rn-expo/power-short-interval-without-appstate": "error",
    "rn-expo/storage-kv-store-key-prefix": ["error", { "prefix": "^myapp:[\\w-]+:v\\d+$" }],
    "rn-expo/router-screen-conventions-default-export-required": "error",
    "rn-expo/env-expo-public-prefix-only": "error",
    "rn-expo/imports-flashlist-estimated-item-size": "error",
    "rn-expo/compat-no-es2023-array-methods": "error"
  }
}
```

The plugin's lint-reference name is `rn-expo` (rule keys are `rn-expo/<rule>`).

For a complete drop-in starter — including the oxlint built-in plugins (`react`, `react-perf`, `jsx-a11y`, `promise`), `no-restricted-imports` bans for AsyncStorage / sentry-expo / `expo-av` / raw `Image` from `react-native` / etc., React-19 overrides, and pre-commit wiring — see [`examples/.oxlintrc.json`](./examples/.oxlintrc.json) and [`examples/README.md`](./examples/README.md).

## Rules

| Rule | Domain | Default |
|------|--------|---------|
| `required-wrappers-gesture-handler-root` | required-wrappers | error |
| `i18n-no-hardcoded-jsx-text` | i18n | warn |
| `color-tokens-no-hex-literal-in-component` | color-tokens | warn |
| `power-short-interval-without-appstate` | power | error |
| `storage-kv-store-key-prefix` | storage | error (requires `prefix` option) |
| `router-screen-conventions-default-export-required` | router | error |
| `env-expo-public-prefix-only` | env | error |
| `imports-flashlist-estimated-item-size` | imports/lists | error |
| `compat-no-es2023-array-methods` | compat | error |

Each rule's rationale is in [`docs/`](./docs) — start with [`docs/00-index.md`](./docs/00-index.md).

## Filename gates (configurable)

Most rules scope themselves to mobile-app source via a path prefix. Configure via shared settings:

```jsonc
{
  "settings": {
    "rn-expo": {
      // Defaults to ["apps/mobile"] (preserves pre-0.1 behavior).
      "appRoots": ["apps/mobile"]
    }
  }
}
```

Common shapes:

| Layout | `appRoots` |
|--------|-----------|
| Monorepo with `apps/mobile/` (default) | `["apps/mobile"]` |
| Flat repo with `app/` and `src/` at the root | `["."]` |
| Multi-app monorepo | `["apps/mobile", "apps/driver"]` |

Within each root, rules look for `app/` (Expo Router routes), `src/` (library code), or `src/components/` as appropriate. The exact sub-pattern is per rule — see each rule's source under `src/rules/`. The `required-wrappers-gesture-handler-root` and `imports-flashlist-estimated-item-size` rules don't depend on app roots and run on any matching file.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). New rules need a topic file under `docs/` (or an extension of an existing one) and a tested rule under `src/rules/<topic>/<slug>.ts`.

## License

MIT — see [LICENSE](./LICENSE).
