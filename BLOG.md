# From a single crash to a public lint plugin: encoding RN/Expo tribal knowledge as oxlint rules

## The crash

A production Android RN/Expo app crashed on launch with the canonical message:

> Rendered more hooks than during the previous render.

`adb logcat` pointed at one screen: a few `useMemo` and `useEffect` calls had been added below an early return. On the first render the early return didn't fire — all hooks ran. On the second render, with different state, it did — and React saw fewer hooks than before. Boom.

That crash is exactly what `react-hooks/rules-of-hooks` catches. We already had `oxlint` configured. We had not enabled the `react` plugin. The lint rule that would have caught this was sitting in the box, unchecked.

A useful question fell out of that: **what other tribal knowledge are we carrying that a linter could enforce instead?** Things our team learned the hard way that nobody actually wrote down.

## From a fix to a catalog

Rather than just enable the rule and move on, we wrote down everything. Five topic files covering the React/RN/Expo stack we run — Expo SDK 55, RN 0.83, React 19, expo-router, Zustand, react-query, NativeWind v4 — across 16 sections and 203 rules:

- **Hooks, performance, async lifecycle** — rules-of-hooks, exhaustive-deps, AbortController on cleanup, the kinds of things that crash apps.
- **Lists, navigation, layout** — `<FlashList>` requires `estimatedItemSize`; `<GestureHandlerRootView>` must wrap the root layout; never put a virtualized list inside a `<ScrollView>`.
- **State, storage, offline** — kv-store key naming, secret-size budgets, offline write-queue with idempotency keys.
- **Battery, interruptions, outdoors** — `expo-location` accuracy default; `setInterval < 60s` must be gated on AppState; outdoor contrast and gloved-tap drills.
- **Platform, Expo, a11y, testing** — banned imports (AsyncStorage, sentry-expo, expo-av), `EXPO_PUBLIC_` env-var prefix, route-file conventions.

Each rule got a one-line statement, a "Why" (concrete failure mode), a Detection mode (`oxlint-builtin` / `custom-oxlint-plugin` / `ci-check` / `manual-review-only`), and citations.

Then we ran an adversarial review pass. The review found contradictions: the catalog said `expo-av` in one place and `expo-audio`/`expo-video` in another (the SDK 53+ rename); it disagreed with itself on touch-target sizes (Material 48 dp vs HIG 44 dp); it half-assumed dark-mode-by-default while elsewhere requiring outdoor high-contrast. We wrote a reconciliation memo, picked one canonical answer per contradiction, and patched all five files.

The catalog went from **a brain dump** to **a coherent operational artifact** in two passes.

## "Why not just enable everything?"

Phase 1 of operationalization was that — turn on what oxlint already shipped. We added the `react`, `react-perf`, `jsx-a11y`, and `promise` plugins; promoted `rules-of-hooks` and `exhaustive-deps` to `error`; configured `no-restricted-imports` to ban AsyncStorage / sentry-expo / expo-av / `react-native-call-detection` / `react-native-web` plus raw `Image`/`SafeAreaView`/`StatusBar`/Touchables from `react-native`.

Result on a real codebase: 17 errors and ~280 warnings. The 17 errors included the original IntroScreen-class bug (7 `rules-of-hooks` violations on one screen) plus four `exhaustive-deps`, two `no-autofocus`, three `Image` from `react-native`, and one unused import. We fixed them. The original crash is now lint-prevented.

## The half that built-ins don't catch

A lot of the catalog needed AST-level checks specific to RN/Expo that no off-the-shelf plugin shipped:

- "Root `_layout.tsx` must render `<GestureHandlerRootView>`" — needs filename + JSX traversal.
- "`<FlashList>` must have `estimatedItemSize`" — JSX prop required.
- "kv-store keys must match `<app>:<feature>:v<n>`" — call-site analysis with import-graph awareness.
- "User-visible `<Text>` strings must go through `t(...)`" — JSXText + JSXExpressionContainer with allowlist for symbols.
- "No hex color literals in component files" — Literal regex with file-path scope.
- "`setInterval < 60s` must be in a file that references AppState" — call analysis + heuristic source-text scan.
- "`process.env.X` in mobile files must start with `EXPO_PUBLIC_`" — MemberExpression with file-path gate.
- "Expo Router route files must have a default export" — ExportDefaultDeclaration + path-aware predicate.

oxlint released a JS plugin alpha (March 2026) that's ESLint v9-compatible. Same rule shape (`create(context) { return visitors }`), same auto-fix API, runs out-of-process via raw AST transfer at ~5x ESLint speed. Limitations: no type-aware rules, no cross-file analysis, alpha API not under semver.

Two things we couldn't confirm from the docs without trying: whether `context.filename` actually worked, and whether JSXOpeningElement visitors fired. So we did the smallest possible thing first.

## P0: smoke-test the alpha

We picked the rule that exercised both uncertainties simultaneously — `gesture-handler-root` — because it needs a file-path predicate (root `app/_layout.tsx`) AND JSX traversal (find `<GestureHandlerRootView>`). If both worked, every other rule shape was reachable. If either failed, we'd know to fall back to ESLint compat.

We scaffolded a TypeScript package, wrote vitest tests against ESLint's `RuleTester`, implemented the rule in ~30 lines, wired it into `.oxlintrc.json` via `jsPlugins`, and stripped `<GestureHandlerRootView>` from the actual root layout to verify the rule fired on a real bug. It did. `context.filename` worked. JSX visitors worked. Both gates green.

That commit literally wrote a `P0-RESULT.md` saying so. The next plan was unblocked.

## P1–P3: ship the long tail

Following the same TDD pattern (failing test → implementation → wire into the consumer config → repo-wide smoke test), we shipped the next seven rules one by one. Two false-positive fixes surfaced from running each rule against the real codebase:

1. The `default-export-required` rule was too strict — it didn't recognize `export { default } from '...'` re-exports.
2. The `expo-public-prefix-only` rule fired on a build-time Expo config plugin reading `JAVA_HOME`. Config plugins run during `expo prebuild`, not in the JS bundle. We added a `BUILD_TIME` exclusion regex.

A third real finding came from the user's instinct to verify each silent rule actually had something to fire on. The `kv-store-key-prefix` rule reported zero hits on a codebase that *did* use kv-store. Reading the import line revealed the gap: `import kv from 'expo-sqlite/kv-store'` — a default import the rule's import-graph helper didn't track. Fixed.

It also surfaced a spec/reality mismatch: the catalog had said `ne:vN:` prefix; the code actually used `ne:<feature>:v<n>`. The rule was originally hardcoded to the spec, but the spec was wrong. We made the rule's prefix configurable via `{ prefix: "..." }` options, then updated the catalog to match real-world practice.

By the end: 8 rules, 9 vitest specs (18 cases), 0 errors on the production repo, 351 warnings — almost all of them either i18n (97) or hex literals (20), both intentionally `warn`-level for incremental cleanup.

## Extracting to a public artifact

The plugin lived under `tooling/oxlint-plugin-rn-expo/` in the host repo for the duration of v1. Once it stabilized, we carved it out:

1. Genericized the catalog — dropped project-specific names, added an "Origins" appendix to keep the real-world grounding.
2. Set up a standalone repo with `package.json` (renamed for npm), `LICENSE` (MIT), `README`, `CONTRIBUTING`, and a `.github/workflows/ci.yml` that runs `pnpm typecheck && pnpm test && pnpm build` on every push.
3. Pushed to https://github.com/Ludentes/rn-oxc-custom-plugin.

The catalog ships *with* the plugin as `docs/`. The rules and the rationale travel together so a maintainer who finds a rule confusing can read the topic file two clicks away.

## How to use it

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
    "rn-expo/imports-flashlist-estimated-item-size": "error"
  }
}
```

A few rules have hardcoded path predicates (`/apps/mobile/(app|src/components)/`) — adjust to your repo layout, or send a PR to make those configurable. Most rules work everywhere.

For ESLint users: rule files are plain `Rule.RuleModule` objects, so the same package can be loaded as an ESLint plugin with no code changes.

## The full config — what's actually in `.oxlintrc.json`

The custom rules are only half the story. The complete starter config that ships with the package (under [`examples/`](https://github.com/Ludentes/rn-oxc-custom-plugin/tree/main/examples)) pairs them with the oxlint built-ins that complete the operational picture:

```jsonc
{
  "plugins": ["typescript", "unicorn", "oxc", "import",
              "react", "react-perf", "jsx-a11y", "promise"],
  "jsPlugins": ["rn-oxc-custom-plugin"],
  "categories": {
    "correctness": "error",
    "suspicious": "warn",
    "perf": "warn"
  },
  "rules": {
    "no-restricted-imports": ["error", { /* see below */ }],
    "rn-expo/...": "error",
    "react/rules-of-hooks": "error",
    "react/exhaustive-deps": "error",
    "react/react-in-jsx-scope": "off",
    "jsx-a11y/no-autofocus": "off",
    /* ...more */
  }
}
```

Three pieces are worth calling out:

**The `react` plugin enable.** This is the line that catches the original crash. oxlint ships the rule but not enabled — so a fresh oxlint setup will let `useMemo`-below-early-return through silently. The single line `"react"` in `plugins` plus `"react/rules-of-hooks": "error"` is what closes the gap.

**`no-restricted-imports`.** A surprising amount of the catalog is enforceable as banned imports — no AST plugin needed. We use it for:

- `@react-native-async-storage/async-storage` (hits Android's 6 MB SQLite cap)
- `sentry-expo` (dead since Jan 2024)
- `expo-av` (deprecated SDK 53+, replaced by `expo-audio` / `expo-video`)
- `react-native-call-detection` (Play Store sensitive permission)
- `react-native-web` (Expo bundles its own; importing causes duplicates)

Plus banned **named** imports from `react-native`:

- `Image` → use `expo-image` (caching, blurhash, recycling-key)
- `SafeAreaView` → use `react-native-safe-area-context`
- `StatusBar` → use `expo-status-bar`
- `Touchable*` (4 variants) → use `Pressable`

Each ban carries its own error message explaining the replacement, so the lint output is its own onboarding doc.

**React-19 overrides.** `react/react-in-jsx-scope` must be `off` — the new automatic JSX runtime makes the `React` import unnecessary, and without this every file warns. `jsx-a11y/no-autofocus` is also turned off because `autoFocus` on a `<TextInput>` is benign in RN (focuses one input, not the page) — the web-targeted rule is just noise on mobile.

The full annotated config lives in [`examples/README.md`](https://github.com/Ludentes/rn-oxc-custom-plugin/blob/main/examples/README.md), with the husky + lint-staged pre-commit/pre-push wiring at the bottom — copy-paste ready.

## Lessons

- **Tribal knowledge is reachable.** Most "things only senior engineers know" can be turned into AST checks given a calm afternoon and a coherent catalog.
- **Smoke-test the platform before committing.** A 30-minute P0 saved us from a half-built rule library on a possibly-broken alpha API.
- **Run rules against real code as you ship them.** Every rule we shipped surfaced a real gap or a real false positive. Synthetic test fixtures are necessary but not sufficient.
- **Spec/reality mismatches are normal.** When the catalog says one thing and the code says another, default to updating the catalog.
- **Reconciliation is mandatory.** A first-pass catalog will contradict itself in three places; without a reconciliation pass it will never become a coherent artifact.

## What's next

- More rules from the catalog tail (P4) — there's another ~20 we haven't shipped yet, including `expo-image` recycling-key inside virtualized lists (needs a cleaner cross-callback ancestry API in the alpha than we have today).
- A `wrapperModules` option for the storage rule so it can follow keys through project-specific wrappers.
- Configurable filename predicates so the path gates aren't repo-shaped.
- An ESLint flat-config preset for users who haven't migrated to oxlint yet.

PRs welcome.
