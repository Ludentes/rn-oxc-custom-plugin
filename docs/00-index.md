# RN / Expo Best Practices — Operational Catalog

**Status:** v1 — research complete, awaiting review before operationalization.
**Date:** 2026-05-04.
**Stack assumed:** Expo SDK 55, React Native 0.83, React 19, expo-router, Zustand + @tanstack/react-query, NativeWind v4, Android-primary with web export.

## Why this exists

An Android RN/Expo app crashed with "Rendered more hooks than during the previous render" — caused by `useMemo`/`useEffect` calls placed below an early return inside a screen component. That class of bug is mechanically detectable. So is most of what's in this catalog. The goal: **encode every hard-won practice as a lint rule, a custom AST check, or a CI gate — not as tribal knowledge.**

## How to read

Each rule in the topic files follows this schema:

```
### topic/rule-slug: <one-sentence rule>

**Why:** <concrete failure mode>
**Detection:** `oxlint-builtin: <rule>` | `custom-oxlint-plugin` | `ci-check` | `manual-review-only`
**Sources:**
- [Title](url)
```

Detection modes:

- **`oxlint-builtin`** — already shipped in oxlint's `react`, `react-perf`, `jsx-a11y`, `unicorn`, `import`, or `typescript` plugins. Enable in `.oxlintrc.json`, done.
- **`custom-oxlint-plugin`** — needs an AST check we author ourselves. oxlint has a JS plugin alpha (March 2026, ESLint v9-compatible) so we write these as JS/TS plugins under `tooling/oxlint-plugin-rn/`. Each `custom-oxlint-plugin` entry includes a one-phrase AST sketch.
- **`ci-check`** — non-AST CI script (file existence, manifest field, env var presence, JSON schema check, dependency audit, bundle-size threshold). Lives under `tooling/ci-checks/` and runs in the same CI step as lint.
- **`manual-review-only`** — semantic judgment (e.g., "is this contrast ratio sufficient outdoors?"). Enforce via PR template, design-handoff checklist, or physical-device drill.

## Topics

| File                                                                         | Sections                                                         | Rule count |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------: |
| [01-hooks-perf-lifecycle.md](01-hooks-perf-lifecycle.md)                     | Hooks & rendering · Performance · Async lifecycle & memory leaks |         44 |
| [02-ui-navigation-layout.md](02-ui-navigation-layout.md)                     | Lists & images · Navigation (Expo Router) · Layout & safe area   |         40 |
| [03-state-storage-offline.md](03-state-storage-offline.md)                   | State management · Storage · Offline-first                       |         41 |
| [04-battery-interruptions-outdoors.md](04-battery-interruptions-outdoors.md) | Battery · Interruptions · Outdoors / sunlight                    |         37 |
| [05-platform-expo-a11y-testing.md](05-platform-expo-a11y-testing.md)         | Platform & env · Expo specifics · Accessibility & i18n · Testing |         41 |
| **Total**                                                                    | 16 sections                                                      |    **203** |

> Reconciliation pass on 2026-05-04: dropped duplicate / contradicting / out-of-stack rules and consolidated cross-refs. See [00-reconciliation.md](00-reconciliation.md).

## The triggering bug

The crash that triggered this catalog maps to `hooks/no-conditional-call` in section 01: hooks must be declared before any conditional return. Confirmed lintable via oxlint's `react/rules-of-hooks` (you must enable the `react` plugin in `.oxlintrc.json`). That rule is the canary — once operationalized, this class of bug surfaces at lint time instead of in production.

## Operationalization plan

**Phase 1 — turn on what oxlint already ships.** Update `.oxlintrc.json`:

- Add `react`, `react-perf`, `jsx-a11y`, `promise` to `plugins`.
- Promote rules listed as `oxlint-builtin` across all 5 files to `error` or `warn` per the catalog.

**Phase 2 — author custom oxlint plugins.** Under `tooling/oxlint-plugin-rn/`, group rules by domain:

- `rn-imports` — banned imports (AsyncStorage, sentry-expo, raw `Image`/`SafeAreaView`/`StatusBar`/Touchables from `react-native`, `react-native-call-detection`).
- `rn-required-wrappers` — root `_layout.tsx` must wrap in `<GestureHandlerRootView>` and `<SafeAreaProvider>`.
- `rn-env` — `EXPO_PUBLIC_*` naming convention; no other env vars referenced from JS bundle.
- `rn-color-tokens` — no hex literals in component files; must come from theme module.
- `rn-storage` — kv-store key naming (`<app>:<feature>:v<n>`, e.g. `ne:tq-cache:v1`); SecureStore values ≤2 KB.
- `rn-power` — `expo-location` Accuracy default; `setInterval` shorter than 60 s gated on AppState; `expo-keep-awake` paired with cleanup.
- `rn-i18n` — no hard-coded JSX strings; all user-visible text routed through `t(...)`.
- `rn-router-screen-conventions` — every route file exports a default component; auth guards in `_layout.tsx`.

Each plugin is a small JS file with rule modules; tested with snapshot fixtures.

**Phase 3 — pre-commit and CI.**

- `husky` + `lint-staged` on staged `.ts`/`.tsx` files: `oxlint` + `oxfmt --check`.
- Pre-push hook: `pnpm typecheck` + `pnpm lint` (full repo).
- CI: same + `expo-doctor`, `--max-warnings=0`.

**Phase 4 — fix all violations.** Start with the highest-severity rule (rules-of-hooks), sweep until clean.

## Manual-review checklists (Phase 5, future)

These are too semantic to lint but worth tracking:

- **Contrast audit** — every screen reviewed under bright outdoor lighting (lightbox or physical-phone field test) before release; record pass/fail per screen.
- **Phone-call drill** — happy path with incoming call mid-form; verify autosave + resume.
- **Battery profile** — Battery Historian run on a representative session; flag any wake-lock > 30s without justification.
- **Offline drill** — airplane-mode for 10 min during a write; verify queue drains on reconnect.
- **Outdoor drill** — physical phone outdoors at noon; readability + tap accuracy gloved hands.

## Caveats from research

Three flags from the agents that you should know before operationalizing:

1. **oxlint built-in claims** in section 01 are based on the oxlint→eslint rule mapping; the live rules index page returned 404 during research. Before promoting any rule to `error`, run `pnpm exec oxlint --rules | grep <rule>` to confirm it ships in our pinned `oxlint@^1.0.0`. Downgrade to `custom-oxlint-plugin` if missing.
2. **Section 02** is honest: only `no-restricted-imports` is claimed as built-in. Most UI rules require AST awareness of expo-router file location or JSX ancestry — they are custom plugin work.
3. **Section 04** is almost entirely `custom-oxlint-plugin` or `manual-review-only`. None of the proposed battery/interruption/outdoor rules map to existing oxlint built-ins. The biggest leverage from this section is the manual-review checklists, not lint rules.

## What this catalog does NOT cover (by design)

- Backend / server-side concerns.
- Build/deploy infrastructure (out of scope for a lint catalog).
- Visual design tokens (separate concern from rules; consult your design system).
- TMA / Telegram Mini-App variants (different runtime; rules don't transfer).

## Origins

This catalog originated from a real production RN/Expo app — an Android-primary civic-info app whose users were outdoors, on cellular, often in suboptimal conditions. The first crash that triggered it was the canonical hooks-below-early-return error described above. From there the catalog grew to encode the practices the team had been carrying as tribal knowledge into machine-checkable rules.
