# Platform, Expo, accessibility, and testing

> See [00-reconciliation.md](00-reconciliation.md) for detection modes, slug conventions, and resolution decisions.

Lint-enforceable rules for Expo SDK 55 / RN 0.83 / React 19 / expo-router (Android-primary, web export).

## Platform & env

### platform/branch-only-when-different: Branch on `Platform.OS` only when behaviour truly differs; prefer `Platform.select` over chained ternaries

**Why:** Sprinkled `if (Platform.OS === 'ios')` blocks fragment logic and rot when a third platform (`web`) appears; `Platform.select` is exhaustive and inspectable.
**Detection:** `custom-oxlint-plugin` — flag `if/ternary` whose test is a `Platform.OS === 'literal'` comparison repeated >2x in a file; suggest `Platform.select`.
**Sources:**

- [Platform-Specific Code — React Native](https://reactnative.dev/docs/platform-specific-code)
- [Platform API — React Native](https://reactnative.dev/docs/platform)

### platform/use-extension-files: Use platform-extension files (`Foo.ios.tsx`, `Foo.android.tsx`, `Foo.web.tsx`) for divergent module bodies, never duplicate component trees inline

**Why:** Metro picks the right extension automatically; inline branching balloons bundle size on every platform because dead branches still ship.
**Detection:** `custom-oxlint-plugin` — flag files where the same component is conditionally rendered across all three platforms; recommend extension split.
**Sources:**

- [Platform-Specific Extensions — React Native](https://reactnative.dev/docs/platform-specific-code#platform-specific-extensions)
- [Metro resolver](https://metrobundler.dev/docs/resolution/)

### platform/expo-public-env-only: Only `EXPO_PUBLIC_*` env vars may be referenced from JS; never store secrets in them

**Why:** `EXPO_PUBLIC_*` is the single prefix Metro inlines into the bundle in plain text; any other `process.env.X` reference resolves to `undefined` at runtime, and prefixed values are visible to anyone with the APK.
**Detection:** `custom-oxlint-plugin` — flag `process.env.X` where `X` does not start with `EXPO_PUBLIC_`; second rule: flag `EXPO_PUBLIC_*` names containing `SECRET|TOKEN|KEY|PRIVATE`.
**Sources:**

- [Environment variables in Expo](https://docs.expo.dev/guides/environment-variables/)
- [Environment variables and secrets — EAS](https://docs.expo.dev/eas/environment-variables/)

### platform/env-static-dot-access: Reference env vars statically via dot notation — `process.env.EXPO_PUBLIC_X`, never bracket access

**Why:** Metro's static replacer only inlines the dot-notation form; `process.env['EXPO_PUBLIC_X']` survives as a runtime lookup that returns `undefined` in production.
**Detection:** `custom-oxlint-plugin` — flag `MemberExpression` with `computed: true` whose object is `process.env`.
**Sources:**

- [Environment variables in Expo — Bundling restrictions](https://docs.expo.dev/guides/environment-variables/)

### platform/single-app-config: Use `app.config.js` (or `.ts`) when any value is env-driven; do not keep both `app.json` and `app.config.js`

**Why:** Expo merges `app.config.{js,ts}` over `app.json` when both exist (the JS config returned extends/overrides JSON — it is _not_ silently ignored). Pick one — having both is a footgun for stakeholders editing `app.json` who don't realize `app.config.js` overrides them. CI fails if both files exist with non-trivial overlapping fields.
**Detection:** `ci-check` — fail CI if both `app.json` and `app.config.{js,ts}` exist with overlapping non-trivial fields; require `.js` when `EXPO_PUBLIC_*` appears in any `.env` file.
**Sources:**

- [App config — Expo](https://docs.expo.dev/workflow/configuration/)
- [Dynamic configuration — Expo](https://docs.expo.dev/workflow/configuration/#dynamic-configuration)

### platform/new-arch-mandatory: `newArchEnabled: true` is mandatory in SDK 55; do not toggle it off to "fix" a third-party crash

**Why:** SDK 55 ships RN 0.83 where the legacy bridge is on its way out; community libs increasingly assume Fabric/TurboModules. Disabling new arch hides bugs and breaks `expo-router` v6 features.
**Detection:** `ci-check` — schema check on `app.config.js` exported object: assert `expo.newArchEnabled === true`.
**Sources:**

- [New Architecture — Expo](https://docs.expo.dev/guides/new-architecture/)
- [Expo SDK 55 release notes](https://expo.dev/changelog)

### platform/no-top-level-notification: Do not place a top-level `notification` field in `app.json`/`app.config.js` under SDK 55

**Why:** The schema moved notification config under `expo.notification` and `expo-notifications` plugin options; the legacy top-level field now triggers a schema error and `expo prebuild` fails.
**Detection:** `ci-check` — config validator: forbid root-level `notification` key, require it under `expo.*`.
**Sources:**

- [expo-notifications — Expo](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [App config reference](https://docs.expo.dev/versions/latest/config/app/)

### platform/guard-native-only-imports: Wrap any conditional native module import behind `Platform.OS !== 'web'` or use platform-extension files

**Why:** Importing a native module at the top level (`import * as Haptics from 'expo-haptics'`) executes on web export and throws "Unsupported native module" at first render.
**Detection:** `custom-oxlint-plugin` — configurable `no-restricted-imports`-style denylist of native-only expo modules; flag bare imports unless inside a `.native.tsx` / `.android.tsx` / `.ios.tsx` file or guarded by `Platform.OS`.
**Sources:**

- [Web support — Expo](https://docs.expo.dev/workflow/web/)
- [expo-router on Web](https://docs.expo.dev/router/reference/web/)

### platform/hermes-required: Hermes is the default JS engine for SDK 55; do not opt into JSC without a documented reason

**Why:** JSC has no source-map support in newer Sentry releases, slower startup, and missing Intl polyfill paths the team relies on for `ru` locale formatting.
**Detection:** `ci-check` — fail if `expo.jsEngine === 'jsc'` in app config.
**Sources:**

- [Using Hermes — Expo](https://docs.expo.dev/guides/using-hermes/)
- [Hermes — React Native](https://reactnative.dev/docs/hermes)

### platform/metro-extends-expo: `metro.config.js` must extend `expo/metro-config` (not bare `@react-native/metro-config`)

**Why:** The Expo preset wires up asset hashing, monorepo resolution, NativeWind, and `expo-router` static routes. Bypassing it breaks web export and `expo-asset` hashing.
**Detection:** `custom-oxlint-plugin` — flag `require('@react-native/metro-config')` or `getDefaultConfig` not imported from `expo/metro-config`.
**Sources:**

- [Customizing Metro — Expo](https://docs.expo.dev/guides/customizing-metro/)

### platform/no-react-native-web-direct: Never import from `react-native-web` directly; let Metro alias `react-native` -> `react-native-web` for web target

**Why:** Direct imports leak web-only types into native files and break tree-shaking. The alias is automatic with `expo/metro-config`.
**Detection:** `oxlint-builtin: import/no-restricted-paths` (or `eslint/no-restricted-imports`) configured to ban `react-native-web`.
**Sources:**

- [Web — Expo](https://docs.expo.dev/workflow/web/)

### platform/web-as-real-branch: Treat `Platform.OS === 'web'` as a real branch, not an afterthought; explicitly guard touch-only gestures and `Modal`

**Why:** `react-native-gesture-handler` works on web but `Modal` and `Pressable` ripple effects do not; the Russian voter app exports to web for ops dashboards and crashes silently when touch-only screens render.
**Detection:** `manual-review-only` — code review checklist; cannot be reliably statically detected.
**Sources:**

- [Modal — React Native](https://reactnative.dev/docs/modal)
- [react-native-gesture-handler — web support](https://docs.swmansion.com/react-native-gesture-handler/docs/guides/web-support/)

---

## Expo specifics

### expo/pin-expo-tilde: Pin `expo` to `~55.0.x` exactly — no `^`, no floating major

**Why:** Expo's monthly patch cycle ships breaking deprecations behind minor bumps; `^55.0.0` will silently jump to `55.5.0` and detach from the EAS Build runtime image, producing reproducible "works locally, breaks on EAS" failures.
**Detection:** `ci-check` — package.json schema check: `expo` must match `~55.0.\d+`; fail on `^` or `>=`.
**Sources:**

- [SDK Versions — Expo](https://docs.expo.dev/versions/latest/)
- [Upgrading Expo SDK](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)

### expo/router-floats-with-expo: Never version `expo-router` independently of `expo` — let `expo install` resolve it

**Why:** `expo-router` is tightly coupled to the Expo runtime; mismatched versions produce "Unable to resolve `expo-router/entry`" or silent broken navigation on cold start.
**Detection:** `ci-check` — package.json check: any `expo-*` package version must match the version produced by `expo install --check`. Run `expo install --check` in CI as a hard gate.
**Sources:**

- [Install Expo Router](https://docs.expo.dev/router/installation/)
- [expo install — Expo](https://docs.expo.dev/more/expo-cli/#install)

### expo/sentry-rn-not-sentry-expo: Use `@sentry/react-native` directly with the `expo` config plugin — `sentry-expo` is dead since Jan 2024

**Why:** `sentry-expo` is unmaintained, breaks on SDK 50+, and prevents source-map upload. The replacement is `@sentry/react-native` plus `withSentry` plugin set up via `npx @sentry/wizard@latest -i reactNative`.
**Detection:** `custom-oxlint-plugin` — ban `import` / `require` from `'sentry-expo'`; ban `sentry-expo` in `package.json`.
**Sources:**

- [Using Sentry — Expo](https://docs.expo.dev/guides/using-sentry/)
- [@sentry/react-native — Expo integration](https://docs.sentry.io/platforms/react-native/manual-setup/expo/)

### expo/no-expo-publish: Never call `expo publish` — it is dead since SDK 49; use EAS Update only

**Why:** `expo publish` writes to the legacy Classic Updates service which is shut down; commands now silently no-op or error and CI scripts break.
**Detection:** `custom-oxlint-plugin` — grep CI scripts and package.json `"scripts"` for `expo publish`.
**Sources:**

- [Migrate to EAS Update](https://docs.expo.dev/eas-update/migrate-from-classic-updates/)
- [EAS Update introduction](https://docs.expo.dev/eas-update/introduction/)

### expo/fcm-v1-only: FCM V1 only — no Legacy server keys (dead Sep 2024)

**Why:** `google-services.json` is mandatory in SDK 55; FCM Legacy `server_key` requests are 404'd by Google. EAS push uses the V1 service account credential.
**Detection:** `ci-check` — fail if `google-services.json` is missing when `expo-notifications` is installed; ban `expo push:android:upload --api-key` in CI scripts.
**Sources:**

- [FCM V1 Migration — Expo](https://docs.expo.dev/push-notifications/sending-notifications-custom/)
- [Set up FCM credentials — EAS](https://docs.expo.dev/push-notifications/fcm-credentials/)

### expo/pin-eas-cli: Pin `eas-cli` in CI — never `npm install -g eas-cli@latest`

**Why:** `eas-cli` minor releases occasionally change `eas.json` schema; an unpinned `@latest` pull turns a green PR red overnight.
**Detection:** `ci-check` — scan workflow YAML and Dockerfiles for `eas-cli` without an exact version.
**Sources:**

- [EAS CLI release notes](https://github.com/expo/eas-cli/releases)
- [eas.json reference](https://docs.expo.dev/build-reference/eas-json/)

### expo/three-eas-profiles: Maintain three EAS Build profiles: `development`, `preview`, `production`; map them to update channels of the same name

**Why:** Mismatched channel/profile names route OTA updates to the wrong builds, causing test code to land on production phones.
**Detection:** `ci-check` — JSON validator for `eas.json` requiring the three profiles and matching `channel` field.
**Sources:**

- [Build profiles — EAS](https://docs.expo.dev/build/eas-json/)
- [EAS Update channels](https://docs.expo.dev/eas-update/eas-cli/)

### expo/runtime-version-on-native-change: Bump `runtimeVersion` whenever any native code, native dep, or expo-\* SDK changes — JS-only changes do not

**Why:** Pushing an OTA built against new native code to an old binary causes immediate crash on next launch. Use the `fingerprint` policy to automate this.
**Detection:** `ci-check` — diff hook: if `package.json` adds/changes a package containing `"plugin"` in its expo config or any `android/`, `ios/`, `plugins/` file changed, require `runtimeVersion` bump or `fingerprint` policy.
**Sources:**

- [Runtime versions and updates](https://docs.expo.dev/eas-update/runtime-versions/)
- [Fingerprint runtime version policy](https://docs.expo.dev/eas-update/runtime-versions/#fingerprint-runtime-version-policy)

### expo/sentry-sourcemap-upload: Source maps must upload via the `@sentry/react-native/expo` plugin on every EAS Build and EAS Update

**Why:** Without source maps, Hermes-minified stacks are unreadable; production triage takes hours instead of minutes. The `@sentry/react-native/expo` config plugin uploads source maps automatically during `eas build` when `SENTRY_AUTH_TOKEN` is set. If a manual upload step is ever needed, the canonical command is `npx @sentry/react-native upload-sourcemaps`. Never use any `sentry-expo-*` script — those belong to the dead `sentry-expo` package.
**Detection:** `ci-check` — assert `SENTRY_AUTH_TOKEN` is declared in every EAS Build profile env, and the `@sentry/react-native/expo` plugin is registered in `app.config.js`.
**Sources:**

- [Using Sentry — Expo](https://docs.expo.dev/guides/using-sentry/#source-maps)
- [@sentry/react-native — Expo plugin](https://docs.sentry.io/platforms/react-native/manual-setup/expo/)

### expo/run-expo-doctor: Run `expo-doctor` in CI on every PR

**Why:** Catches mismatched versions, unmet peer deps, and config-plugin ordering bugs before they reach EAS Build (where each failed build costs 5–15 min).
**Detection:** `ci-check` — require `npx expo-doctor` step in the test workflow.
**Sources:**

- [expo-doctor](https://docs.expo.dev/develop/development-builds/installation/#expo-doctor)

### expo/prune-unused-expo-packages: Prune unused `expo-*` packages quarterly — every plugin adds APK weight and a config-plugin step

**Why:** Unused expo modules still register native code via autolinking; SDK 55 binaries ballooned 4–6 MB in real projects from forgotten `expo-camera`, etc.
**Detection:** `ci-check` — knip-style unused-export check across `expo-*` imports; flag any expo package in `dependencies` with zero JS imports in the app source tree.
**Sources:**

- [Reducing bundle size — Expo](https://docs.expo.dev/guides/analyzing-bundles/)
- [Config plugins](https://docs.expo.dev/config-plugins/introduction/)

### expo/plugins-as-string-paths: Config plugins must live in a `plugins/` directory with explicit version pinning, not inline in `app.config.js`

**Why:** Inline plugin functions are not portable across `expo prebuild` runs and silently re-run on every CI invocation, sometimes mutating native files non-deterministically.
**Detection:** `custom-oxlint-plugin` — flag arrow functions inside the `plugins` array of the exported config; require string paths.
**Sources:**

- [Creating a config plugin](https://docs.expo.dev/config-plugins/plugins-and-mods/)

### expo/no-direct-native-dir-edits: Never edit `android/` or `ios/` directly when using CNG — re-run `expo prebuild --clean`

**Why:** Manual edits are wiped on the next prebuild, so the change appears to work locally and disappears on EAS. Use a config plugin for any persistent native change.
**Detection:** `manual-review-only` — `.gitignore` should ideally include `android/` and `ios/`; if they are tracked, code review must enforce the rule.
**Sources:**

- [Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/)

### expo/no-expo-av-import: Ban `from 'expo-av'` imports outright

**Why:** `expo-av` is being phased out. SDK 55 ships `expo-audio` and `expo-video` as the canonical packages. New code MUST use those; existing `expo-av` callsites must migrate.
**Detection:** `custom-oxlint-plugin` (or `oxlint-builtin: eslint/no-restricted-imports`) — flag any `import` / `require` from `'expo-av'`.
**Sources:**

- [expo-audio — Expo](https://docs.expo.dev/versions/latest/sdk/audio/)
- [expo-video — Expo](https://docs.expo.dev/versions/latest/sdk/video/)

### expo/root-wrappers

> Canonical: see [layout/gesture-handler-root-wrap](02-ui-navigation-layout.md#layoutgesture-handler-root-wrap).

---

## Accessibility & i18n

### a11y/touchable-role-and-label: Every `Pressable`/`TouchableOpacity` must declare `accessibilityRole` and `accessibilityLabel`

**Why:** Without a role TalkBack announces "double-tap to activate" for an unlabelled element; users abandon the screen. The label must convey purpose, not visual label ("Submit ballot", not "Tap me").
**Detection:** `custom-oxlint-plugin` — flag touchable wrappers without both props. (The oxlint `jsx-a11y` plugin's built-in rules target DOM elements only.)
**Sources:**

- [Accessibility — React Native](https://reactnative.dev/docs/accessibility)
- [WCAG 2.2 — 4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html)

### a11y/accessible-on-wrapper-only: Set `accessible={true}` on the touchable wrapper, not on every nested `<Text>`

**Why:** TalkBack treats nested accessible nodes as separate focus stops, so a single button announces 3–4 times. The wrapper merges children into one announcement.
**Detection:** `custom-oxlint-plugin` — flag `accessible={true}` on `<Text>` inside a `<Pressable accessible>`; flag missing `accessible` on touchable wrappers when children include `<Text>`.
**Sources:**

- [accessible prop — React Native](https://reactnative.dev/docs/accessibility#accessible)

### a11y/use-accessibility-state: Use `accessibilityState` for selected/disabled/expanded/checked, never custom strings inside the label

**Why:** Screen readers translate state to localized announcements ("selected", "вибрано"); a label like "Selected: Yes" is read literally and mispronounced.
**Detection:** `custom-oxlint-plugin` — flag `accessibilityLabel` strings containing `selected|disabled|expanded|checked` (case-insensitive) in any locale.
**Sources:**

- [accessibilityState — React Native](https://reactnative.dev/docs/accessibility#accessibilitystate)
- [WCAG 2.2 — 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html)

### a11y/hint-only-when-non-obvious: Add `accessibilityHint` only when the action is non-obvious, never restate the label

**Why:** Hints are read after a 1-second pause; redundant hints triple announcement length. Users with motor disabilities timeout before content finishes.
**Detection:** `manual-review-only` — flag identical label/hint strings in code review.
**Sources:**

- [accessibilityHint — React Native](https://reactnative.dev/docs/accessibility#accessibilityhint)
- [Apple HIG — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

### a11y/no-global-disable-font-scaling: Never disable `allowFontScaling` globally; cap it per-component if absolutely needed

**Why:** Disabling dynamic type breaks accessibility for low-vision users — the largest demographic of voters in this app. WCAG SC 1.4.4 requires 200% scale.
**Detection:** `custom-oxlint-plugin` — ban `allowFontScaling={false}` at the `<Text>` defaults level; allow per-component with a justification comment `// a11y-allow-no-scale: <reason>`.
**Sources:**

- [Text — React Native](https://reactnative.dev/docs/text#allowfontscaling)
- [WCAG 2.2 — 1.4.4 Resize text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)

### a11y/intl-collator-ru: Sort and compare strings with `Intl.Collator('ru')`, not `String#localeCompare()` with no args

**Why:** Default collation uses the device locale, so a Russian voter list sorts differently on a phone set to English. `Intl.Collator('ru', { sensitivity: 'base' })` gives stable, deterministic order.
**Detection:** `custom-oxlint-plugin` — flag `.localeCompare(` calls with <2 args; flag `.sort()` over arrays of strings without a custom collator comparator.
**Sources:**

- [Intl.Collator — MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator)
- [String.prototype.localeCompare — MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/prototype/localeCompare)

### a11y/intl-format-explicit-locale: Format dates and numbers with `Intl.DateTimeFormat`/`Intl.NumberFormat` keyed to the active locale, never `toLocaleString()` with no args

**Why:** No-arg `toLocaleString` reads the device locale; a Russian-only UI must show `1 234,56 ₽`, not `1,234.56 RUB`. Hermes ships full ICU since RN 0.74.
**Detection:** `custom-oxlint-plugin` — flag `toLocaleString()`/`toLocaleDateString()` with zero arguments.
**Sources:**

- [Intl.NumberFormat — MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat)
- [Intl.DateTimeFormat — MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)

### a11y/no-hardcoded-user-strings: Hard-coded user-visible strings in JSX are banned — every literal must come from the i18n module

**Why:** Inline Russian strings cannot be re-translated, can't be QA'd against a TM, and rot when copy changes; also breaks ICU plural handling.
**Detection:** `custom-oxlint-plugin` — flag any `JSXText` or string literal inside an attribute on the user-visible-prop allowlist (`children` of `Text`, `accessibilityLabel`, `placeholder`, `title`) unless wrapped in `t(...)` / `<Trans>`.
**Sources:**

- [react-i18next — best practices](https://react.i18next.com/latest/using-with-hooks)
- [Format.JS / FormatJS](https://formatjs.io/docs/react-intl/)

### a11y/icu-plurals-not-ternary: Pluralise via ICU MessageFormat, never via `count === 1 ? 'X' : 'Xs'`

**Why:** Russian has 4 plural forms (one, few, many, other); a binary ternary mistranslates 80% of cases. ICU select-ordinal handles all locales.
**Detection:** `custom-oxlint-plugin` — flag ternary expressions whose branches contain string literals and whose test references a variable named `count|n|num|len|size|length`.
**Sources:**

- [CLDR Plural Rules — Unicode](https://cldr.unicode.org/index/cldr-spec/plural-rules)
- [react-i18next — Plurals](https://www.i18next.com/translation-function/plurals)

### a11y/explicit-focus-order: Define explicit focus order on screens with custom layouts using `experimental_accessibilityOrder` or `accessibilityElements` (iOS)

**Why:** Default focus follows DOM order which on Flexbox `row-reverse` rows reads right-to-left visually but left-to-right by index — confusing and fails WCAG 2.4.3.
**Detection:** `manual-review-only` — TalkBack swipe test on each new screen.
**Sources:**

- [accessibilityOrder — React Native](https://reactnative.dev/docs/accessibility#experimental_accessibilityorder)
- [WCAG 2.2 — 2.4.3 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)

### a11y/decorative-images-hidden: Decorative images must set `accessibilityElementsHidden` (iOS) and `importantForAccessibility="no-hide-descendants"` (Android), or `aria-hidden`

**Why:** Otherwise TalkBack announces "image" for every spacer/icon, drowning meaningful content.
**Detection:** `oxlint-builtin: jsx-a11y/alt-text` covers DOM `<img>`; RN `<Image>` requires `custom-oxlint-plugin` to enforce that any `<Image>` either has `accessibilityLabel` or is hidden.
**Sources:**

- [accessibilityElementsHidden — RN](https://reactnative.dev/docs/accessibility#accessibilityelementshidden-ios)
- [importantForAccessibility — RN](https://reactnative.dev/docs/accessibility#importantforaccessibility-android)

### a11y/touch-target-floor-44dp: Touch targets must never go below the 44 dp iOS HIG hard floor

**Why:** 44 dp is the absolute minimum — below this, motor-impaired users cannot reliably hit the target and WCAG 2.5.5 fails. Primary actions use 48 dp per [outdoors/min-touch-target-48dp](04-battery-interruptions-outdoors.md#outdoorsmin-touch-target-48dp). Treat 44 dp as the hard floor; the canonical primary-action threshold is 48 dp.
**Detection:** `custom-oxlint-plugin` — flag `Pressable`/`TouchableOpacity` with `style.height` or `style.width` literal `< 48`. References [outdoors/min-touch-target-48dp](04-battery-interruptions-outdoors.md#outdoorsmin-touch-target-48dp) for the canonical rule.
**Sources:**

- [Apple HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [WCAG 2.2 — 2.5.5 Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size.html)

---

## Testing

### testing/jest-preset-jest-expo: `preset` (top-level Jest config key) must be exactly `'jest-expo'`

**Why:** `jest-expo` ships the native-module mocks, jsdom config, and transformer chain; alternatives like `react-native` preset miss `expo-modules-core` mocks and tests crash on `import {NativeModules}`.
**Detection:** `ci-check` — `jest.config.{js,ts}` validator: top-level `preset === 'jest-expo'`.
**Sources:**

- [Unit testing — Expo](https://docs.expo.dev/develop/unit-testing/)
- [jest-expo on npm](https://www.npmjs.com/package/jest-expo)

### testing/transform-ignore-patterns-full: `transformIgnorePatterns` must whitelist the full ESM chain

The required pattern includes: `react-native`, `@react-native`, `@react-native-community`, `@react-navigation`, `expo`, `expo-router`, `expo-modules-core`, `nativewind`, `tailwindcss`, `escape-string-regexp`, `@unimodules`, `unimodules`, `native-base`, `react-native-svg`.

**Why:** SDK 52+ shipped many of these as ESM-only; without transformation Jest blows up with `SyntaxError: Cannot use import statement outside a module` deep inside a transitive dep — the trace points at jest internals, not the offender.
**Detection:** `custom-oxlint-plugin` — config validator that asserts each required substring is present in `transformIgnorePatterns[0]`.
**Sources:**

- [Unit testing — Expo](https://docs.expo.dev/develop/unit-testing/)
- [Jest transformIgnorePatterns](https://jestjs.io/docs/configuration#transformignorepatterns-arraystring)

### testing/mock-reanimated: Mock `react-native-reanimated` via the official mock in `jest-setup.ts`

**Why:** Reanimated runs on the UI thread via worklets; without `require('react-native-reanimated/mock')` plus disabling its native call, every animated screen throws on render in tests.
**Detection:** `custom-oxlint-plugin` — require either `require('react-native-reanimated/mock')` in setup file or `jest.mock('react-native-reanimated', ...)`.
**Sources:**

- [Reanimated — Testing](https://docs.swmansion.com/react-native-reanimated/docs/guides/testing)

### testing/mock-gesture-handler: Mock `react-native-gesture-handler` with `jest-setup` import of the bundled mock

**Why:** Gesture handlers reach into native; without the mock `<GestureHandlerRootView>` triggers a `null is not an object` crash.
**Detection:** `custom-oxlint-plugin` — require `import 'react-native-gesture-handler/jestSetup'` in `jest.setup.ts`.
**Sources:**

- [react-native-gesture-handler — testing](https://docs.swmansion.com/react-native-gesture-handler/docs/guides/testing/)

### testing/mock-expo-router: Mock `expo-router` via `jest.mock('expo-router', ...)` exposing `useRouter`/`useLocalSearchParams`/`Link`

**Why:** `expo-router` registers a global navigator that is unavailable outside an `_layout` tree; tests on individual screens crash without the mock.
**Detection:** `custom-oxlint-plugin` — require expo-router mock in setup file, or skip if no test file imports `expo-router`.
**Sources:**

- [Testing — expo-router](https://docs.expo.dev/router/reference/testing/)

### testing/prefer-role-label-over-testid: Use `@testing-library/react-native` queries; prefer `getByRole` and `getByLabelText` over `getByTestId`

**Why:** Role/label queries co-test accessibility — a screen that fails RTL queries also fails TalkBack. `testID` is brittle and bypasses a11y validation. Flag `getByTestId` whenever a role or label query would work in its place.
**Detection:** `manual-review-only` — pure-AST analysis cannot reliably determine when a role/label query would have worked. Enforced via PR-review checklist (call out every `getByTestId` and ask "could this be `getByRole` / `getByLabelText`?").
**Sources:**

- [Queries — @testing-library/react-native](https://callstack.github.io/react-native-testing-library/docs/api/queries)
- [Which query should I use? — Testing Library](https://testing-library.com/docs/queries/about/#priority)

### testing/await-async-queries: Async assertions must use `findBy*` or `waitFor`, never bare `getBy*` after a state update

**Why:** State updates happen across microtasks; bare `getBy*` returns null and the test fails with a misleading "element not found".
**Detection:** `custom-oxlint-plugin` — oxlint has no testing-library plugin; we author this rule ourselves, mirroring `eslint-plugin-testing-library`'s `await-async-queries`. Flag bare `getBy*` followed by an `await act(...)` / state-update boundary in the same test.
**Sources:**

- [Async methods — TL](https://callstack.github.io/react-native-testing-library/docs/api/misc/async)

### testing/no-snapshots-on-visual: Snapshot tests are banned for visual-heavy components; allowed for serializer-friendly pure data

**Why:** Snapshots over Reanimated/NativeWind output are 200+ lines of inline class strings, change on every Tailwind config tweak, and are routinely rubber-stamped in PRs — all defects, no signal.
**Detection:** `custom-oxlint-plugin` — flag `toMatchSnapshot()` inside files whose tested component imports `react-native-reanimated`, `nativewind`, or `react-native-svg`.
**Sources:**

- [Effective Snapshot Testing — Kent C. Dodds](https://kentcdodds.com/blog/effective-snapshot-testing)
- [Jest snapshot testing](https://jestjs.io/docs/snapshot-testing)

### testing/network-via-msw: Network calls in tests must go through `msw` (or `msw/native`); hand-rolled `jest.fn()` fetch mocks are banned

**Why:** Hand-rolled mocks drift from the real API contract; `msw` reuses OpenAPI-derived handlers and forces every code path through one boundary.
**Detection:** `custom-oxlint-plugin` — flag `jest.spyOn(global, 'fetch')` and `global.fetch = jest.fn()` patterns; require `msw` import in test setup when network calls are made.
**Sources:**

- [MSW — React Native](https://mswjs.io/docs/integrations/react-native)

### testing/no-renders-without-crashing: No "renders without crashing" smoke tests that only call `render(<X />)`

**Why:** They yield 100% line coverage with zero behavioural signal and then break on every render-time refactor; cost > value.
**Detection:** `custom-oxlint-plugin` — flag `it`/`test` blocks whose body is a single `render(...)` call with no `expect`.
**Sources:**

- [Common mistakes — Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

### testing/coverage-on-changed-files-only: Coverage thresholds apply to changed files only in CI

**Why:** A repo-wide coverage gate punishes refactors with no behavioural change and rewards stuffing trivial tests into legacy code. Per project CLAUDE.md (YAGNI), enforce coverage on the diff only — `--changedSince origin/main` plus a per-file threshold catches regressions where they actually land.
**Detection:** `ci-check` — CI workflow runs `jest --changedSince <base> --coverage` with per-file thresholds; fails if changed files dip below the bar.
**Sources:**

- [Jest CLI — `--changedSince`](https://jestjs.io/docs/cli#--changedsince)
- [Jest coverageThreshold](https://jestjs.io/docs/configuration#coveragethreshold-object)

### testing/e2e-maestro-or-detox: E2E happy-paths run via Maestro (preferred for Expo) or Detox; never Appium directly

**Why:** Maestro has first-class Expo support and runs against EAS preview builds without native rebuilds; Detox needs a custom dev-client. Appium-direct setups break on every Android update.
**Detection:** `manual-review-only` — CI workflow review.
**Sources:**

- [E2E testing — Expo](https://docs.expo.dev/build-reference/e2e-tests/)
- [Maestro docs](https://maestro.mobile.dev/)

### testing/ci-jest-flags: Tests run in CI on every PR with `--maxWorkers=2 --ci --coverage`

**Why:** GitHub-hosted runners only have 2 cores; default `--maxWorkers=auto` causes flaky timeouts. `--ci` forces snapshot strict mode (no auto-write).
**Detection:** `ci-check` — CI YAML check.
**Sources:**

- [Jest CLI options](https://jestjs.io/docs/cli)

### testing/no-implementation-details: Never test implementation details (`useState` value, internal function calls); test rendered output and accessibility tree

**Why:** Implementation-detail tests are the #1 source of false positives during refactors; they prevent the refactor instead of guarding the contract.
**Detection:** `custom-oxlint-plugin` — flag `expect(component.state(...))`, `expect(spy).toHaveBeenCalled()` patterns over private functions, and `instance()` calls.
**Sources:**

- [Avoid Implementation Details — Kent C. Dodds](https://kentcdodds.com/blog/testing-implementation-details)
- [Guiding Principles — Testing Library](https://testing-library.com/docs/guiding-principles)
