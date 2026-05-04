# Example oxlint config

[`.oxlintrc.json`](./.oxlintrc.json) is a complete, drop-in starter config for an Expo SDK 55 / RN 0.83 / React 19 / expo-router / NativeWind v4 app. It pairs the custom rules in this package with the oxlint built-ins that complete the operational picture.

Copy it to the root of your repo and adapt the paths under `rn-expo/storage-kv-store-key-prefix` (the `prefix` regex) and `ignorePatterns` to match your layout.

## What's in the config and why

### Built-in plugins enabled

```jsonc
"plugins": ["typescript", "unicorn", "oxc", "import", "react", "react-perf", "jsx-a11y", "promise"]
```

`react` is the one that catches the canonical "Rendered more hooks than during the previous render" crash via `react/rules-of-hooks` — it is **off by default** in oxlint until the plugin is enabled. The others sweep up correctness, perf, accessibility, and async-handling rules that have been baking in the ESLint ecosystem for years.

### Custom plugin

```jsonc
"jsPlugins": ["rn-oxc-custom-plugin"]
```

Loads this package via npm resolution. Its rules are referenced as `rn-expo/<rule>` (the plugin's `meta.name`).

### Categories

```jsonc
"categories": {
  "correctness": "error",
  "suspicious": "warn",
  "perf": "warn"
}
```

Bulk-promote oxlint's correctness rules to `error` and warn-level suspicious/perf rules. Individual rule overrides below this still apply.

### Banned imports (`no-restricted-imports`)

Catches the most common RN/Expo mistakes at lint time:

- **`@react-native-async-storage/async-storage`** — hits Android's 6 MB SQLite cap and lacks atomicity. Use `expo-sqlite/kv-store`.
- **`sentry-expo`** — dead since Jan 2024. Use `@sentry/react-native` + the Expo config plugin.
- **`expo-av`** — deprecated in SDK 53+. `expo-audio` for audio, `expo-video` for video.
- **`react-native-call-detection`** — requires `READ_PHONE_STATE` (Play Store sensitive permission). Use AppState `'inactive'` / `'blur'` signals instead.
- **`react-native-web`** — Expo's bundle ships its own; importing directly causes duplicate copies.

Plus banned named imports from `react-native`:
- **`Image`** → use `expo-image` (disk caching, blurhash, recycling-key, animated images).
- **`SafeAreaView`** → use `react-native-safe-area-context` (the RN core component is deprecated and does not work on Android notches reliably).
- **`StatusBar`** → use `expo-status-bar` (the only correct wrapper for Expo apps).
- **`Touchable*`** (4 variants) → use `Pressable` (the others are legacy and have been quietly deprecated for years).

### Custom rules (`rn-expo/*`)

These are this package. See the project root [README](../README.md) and [`docs/`](../docs) for the rationale per rule.

### React-plugin overrides

```jsonc
"react/react-in-jsx-scope": "off"
```

React 19's automatic JSX runtime makes the `React` symbol unnecessary. Without this override, every component file would warn.

```jsonc
"jsx-a11y/no-autofocus": "off"
```

`autoFocus` on a `<TextInput>` is benign in RN — it focuses one input on a screen, not the whole page. The web-targeted rule is too noisy to be useful here.

```jsonc
"react/no-unescaped-entities": "off"
```

RN apps render text in `<Text>`, not in HTML; the rule's escaping concerns don't apply.

### Ignore patterns

```jsonc
"ignorePatterns": ["**/dist/**", "**/.turbo/**", "**/node_modules/**", "**/migrations/**"]
```

Standard build-output skips. Adjust to match your monorepo.

## Pre-commit wiring

Pair the config with husky + lint-staged for a fast feedback loop. In `package.json`:

```jsonc
{
  "scripts": {
    "lint": "oxlint",
    "lint:fix": "oxlint --fix",
    "format": "oxfmt",
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx,mjs,cjs}": ["oxlint --fix", "oxfmt"],
    "*.{json,md,yml,yaml}": ["oxfmt"]
  }
}
```

Then `.husky/pre-commit`:

```sh
pnpm exec lint-staged
```

And `.husky/pre-push`:

```sh
pnpm typecheck && pnpm lint
```

The pre-commit hook runs only on staged files (fast). The pre-push hook runs the full repo check before anything reaches the remote.
