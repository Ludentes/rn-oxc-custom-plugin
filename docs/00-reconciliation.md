# Reconciliation Memo

This memo resolves contradictions, duplicates, stack mismatches, and schema drift surfaced by the v1 review of the catalog. Each topic file (01–05) is patched to match the decisions below.

## Schema standardization (applies to all files)

### Detection modes — now four

| Mode                              | When                                                                                                                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `oxlint-builtin: <plugin>/<rule>` | Rule already shipped in oxlint's `react`, `react-perf`, `jsx-a11y`, `unicorn`, `oxc`, `import`, `typescript`, `jest`, `jsdoc`, `nextjs`, `node`, `promise`, `vitest`, or `vue` plugin. Verify via `pnpm exec oxlint --rules \| grep <name>` before promoting to `error`. |
| `custom-oxlint-plugin`            | Author as a JS plugin under `tooling/oxlint-plugin-rn/`. AST hint must be implementable without dataflow analysis or TS type info.                                                                                                                                       |
| `ci-check`                        | Not a lint rule — file presence, package.json schema, app.config.js merge, env-file presence, sibling-file enforcement, contrast/lux audits, etc. Implemented as a `tooling/ci/*.mjs` script run from CI (and pre-push if cheap).                                        |
| `manual-review-only`              | Semantic judgment: contrast in context, queue-pattern correctness, dataflow-dependent flags. Enforce via PR template, design-handoff checklist, or release-drill checklist.                                                                                              |

### Slug IDs replace numeric numbering

All rules switch from `### N. <title>` to `### <topic>/<short-name>: <title>`. Slug topics by file:

| File | Topic prefixes                            |
| ---- | ----------------------------------------- |
| 01   | `hooks/`, `perf/`, `lifecycle/`           |
| 02   | `lists/`, `images/`, `router/`, `layout/` |
| 03   | `state/`, `storage/`, `offline/`          |
| 04   | `battery/`, `interruptions/`, `outdoors/` |
| 05   | `platform/`, `expo/`, `a11y/`, `testing/` |

Cross-references use slugs (e.g. `see [layout/gesture-handler-root-wrap](02-ui-navigation-layout.md#layoutgesture-handler-root-wrap)`). No "see rule N" — that ambiguity is what motivated the change. (Per project CLAUDE.md: avoid section numbering. Rule slugs are stable; renumbering churn goes away.)

### Heading capitalization

All `##` section headings use sentence case: "Hooks & rendering", "State management", "Battery & energy efficiency", "Accessibility & i18n". Title Case is removed.

### Per-file detection legend

Each topic file (01–05) opens with a one-line link back to this memo:

```
> See [00-reconciliation.md](00-reconciliation.md) for detection modes and slug conventions.
```

No file restates the legend.

## Contradiction resolutions

### Memoization (01:5, 01:24, 02:4)

**Decision:** This project does **not** have React Compiler enabled (yet). Manual `useMemo` / `useCallback` is required where identity is observed by a memoized child (`React.memo` row, `<Context.Provider value={...}>`, `FlatList renderItem` whose row is memoized). Manual memo is **not** required for derived values inside leaf components — that's compiler territory.

- `hooks/memoize-only-when-identity-observed` — canonical (formerly 01:5). Stays.
- `perf/memoize-list-row-and-render-item` — canonical (formerly 02:4). Restated: required only when the row component is wrapped in `React.memo`.
- `perf/react-compiler-readiness` — canonical (formerly 01:24). Reframed: "When React Compiler is enabled in this repo, drop manual memo at the same PR. Until then, this rule is dormant — track via `// TODO(react-compiler)` markers, not an enforced lint."

### Touch target size (02:39, 04-outdoors:8, 05:13)

**Decision:** **48 dp × 48 dp minimum** for primary actions (Material baseline; Android-primary). Use `hitSlop` ≥ 8 dp on smaller visual elements to reach the 48 dp logical hit area. 44 dp (iOS HIG minimum) is a hard floor below which we never go.

- `outdoors/min-touch-target-48dp` — canonical (formerly 04-outdoors:8). Threshold is 48 dp.
- `layout/hit-slop-when-visual-under-48dp` — restated (formerly 02:39). Doesn't redeclare the threshold; references the canonical rule.
- `a11y/touch-target-floor-44dp` — restated (formerly 05:13). Detection threshold corrected to flag `< 48`. References the canonical rule.

### Theme / dark-mode policy (04-outdoors:4, 04-outdoors:5, 04-outdoors:14)

**Decision (three rules collapsed to one canonical + two cross-refs):**

The default theme is **light**, optimized for outdoor sunlight. The app does **not** auto-switch to dark based on system settings — auto-dark is a known sunlight-readability footgun for our use case (citizens checking polling station info outdoors). A user-toggleable "outdoor high-contrast mode" is a separate enhancement that intensifies foreground/background contrast within the light palette.

If a future product decision adds a real dark theme (manual opt-in only, never auto), surfaces use `#0a0a0a` (not pure black) — pure black smears on AMOLED in motion. Surfaces in dark mode that need brightness use `≤ 95%` luminance to reduce glare.

- `outdoors/light-default-no-auto-dark` — canonical (combines 04-outdoors:4 and the OLED guidance from :5). One rule.
- `outdoors/high-contrast-mode-toggle` — restated (formerly :14). User-toggleable, NOT linked to system dark-mode preference.

### StatusBar API (02:33, 02:34, 04-outdoors:10)

**Decision:** Use `expo-status-bar` exclusively. The `react-native` `StatusBar` is banned per `images/no-rn-statusbar` (formerly 02:33). The required prop is `style="dark"|"light"|"auto"` — the `barStyle` prop belongs to the banned API.

- `images/no-rn-statusbar` — canonical (formerly 02:33). Bans the import.
- `outdoors/explicit-status-bar-style` — restated (formerly 04-outdoors:10). Reworded to `style="dark"|"light"|"auto"`. The "every screen sets it" requirement stays.

### GestureHandlerRootView ordering (02:26, 02:29, 05:14)

**Decision:** Canonical wrapper order, outermost first:

```tsx
<GestureHandlerRootView style={{ flex: 1 }}>
  <SafeAreaProvider>
    <ThemeProvider>{/* <Stack /> from expo-router */}</ThemeProvider>
  </SafeAreaProvider>
</GestureHandlerRootView>
```

Per react-native-gesture-handler installation docs.

- `layout/gesture-handler-root-wrap` — canonical (formerly 02:29 + 02:40). One rule with the ordered diagram. Detection: AST check on `app/_layout.tsx`.
- `layout/safe-area-provider-once` — restated (formerly 02:26). Says "exactly once, inside GHRV". References canonical.
- `expo/root-wrappers` (formerly 05:14) — collapses to a one-line cross-ref to `layout/gesture-handler-root-wrap`. Keeps the slug for discoverability.

### Idempotency-Key on POSTs (03-offline:4, 04-interruptions:8)

- `offline/idempotency-key-required` — canonical (formerly 03-offline:4). Detection covers all `POST`/`PUT`/`PATCH`/`DELETE` mutation handlers, not just queue workers.
- 04-interruptions removes its standalone rule and cross-refs the canonical one.

## Stack fixes

### Drop RTK Query content (03)

- 03-state has no separate "RTK Query alternative" rule. Remove.
- 03-offline:12 keeps only the `setQueryData` (react-query) branch. Drop the `upsertQueryData` (RTK Query) branch.
- One sentence in the State section's preamble: _"This catalog assumes Zustand + @tanstack/react-query. RTK Query is not in scope; if a future migration is considered, see Phase-X memo (TBD)."_

### Update expo-av → expo-audio / expo-video (04-interruptions:5, :6)

`expo-av` is being phased out in SDK 51+. SDK 55 ships `expo-audio` and `expo-video` as the canonical packages.

- `interruptions/audio-interruption-mode` — canonical (formerly 04-interruptions:5). Use `expo-audio`'s `setAudioModeAsync` with `interruptionModeAndroid: 'duckOthers'` (etc.).
- `interruptions/audio-focus-android` — restated (formerly :6). Use `expo-audio` API references.
- Add `expo/no-expo-av-import` under `expo/` — bans `from 'expo-av'` imports outright.

### Sentry source-map upload (05-expo:9)

- `expo/sentry-rn-not-sentry-expo` — canonical (formerly 05:3). Ban stays.
- `expo/sentry-sourcemap-upload` — restated (formerly 05:9). Replace `sentry-expo-upload-sourcemaps` with: rely on `@sentry/react-native/expo` plugin's automatic upload during `eas build`. If a manual command is ever needed, it's `npx @sentry/react-native upload-sourcemaps`. Never `sentry-expo-*`.

## Duplicate consolidation table

For each duplicate group, one canonical rule survives. The other locations become a one-line cross-reference: `> See [<slug>](<file>#<anchor>) for the canonical rule.`

| Topic                                                 | Canonical home                                 | Cross-ref locations to update                                                                                                                                                |
| ----------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GestureHandlerRootView root wrap                      | 02 `layout/gesture-handler-root-wrap`          | 02 (was :40), 05 (was :14)                                                                                                                                                   |
| Idempotency-Key on writes                             | 03 `offline/idempotency-key-required`          | 04-interruptions (was :8)                                                                                                                                                    |
| expo-image required, ban RN Image                     | 02 `images/expo-image-required`                | 04-battery (was :10)                                                                                                                                                         |
| AppState single subscriber                            | 04 `interruptions/single-app-state-subscriber` | 01 (was :34)                                                                                                                                                                 |
| Reanimated worklets, ban Animated.Value               | 04 `battery/reanimated-not-animated-api`       | 01 (was :20)                                                                                                                                                                 |
| expo-keep-awake paired cleanup                        | 04 `battery/keep-awake-paired-cleanup`         | 01 (was :39)                                                                                                                                                                 |
| AbortController on effect cleanup                     | 01 `lifecycle/abort-controller-on-cleanup`     | 04-interruptions (was :4)                                                                                                                                                    |
| FlatList/FlashList sized rows                         | 02 `lists/estimated-item-size-required`        | 01 (was :19)                                                                                                                                                                 |
| react-query focusManager / onlineManager wiring on RN | 03 `state/react-query-rn-focus-online`         | 01 (was :35)                                                                                                                                                                 |
| Persist version + migrate from day 1                  | 03 `state/persist-version-migrate-day-1`       | 03-offline (the envelope rule stays — different concept, distinct slug `offline/versioned-envelope-day-1`, but adds a "Related" line to state/persist-version-migrate-day-1) |

## Detection-mode re-tagging (re-tag, do not delete)

Promote to `ci-check`:

- All `app.config.js` schema / merge checks (05-platform:5, :6, :7, :9)
- `app.json` field validators (anything that requires JSON parsing of `app.json` at runtime)
- `package.json` schema and version-pin checks (05-expo:1, :2, :5, :6, :8, :10, :11)
- `eas.json` profile validators
- File-pair existence (e.g., sibling `*.test.tsx`) — but see "drop" list below
- `expo-doctor` invocation (becomes a CI step)
- `knip`-style unused-export checks (05-expo:11)
- Sunlight/contrast audit (04-outdoors:13) — script hooked from CI on theme tokens
- Storybook a11y audit (04-outdoors:1)

Demote `oxlint-builtin` → `manual-review-only`:

- 01:4 (`react/hook-use-state` was cited for _naming_; that rule enforces destructuring, not naming).
- 05-testing:7 (`testing-library/await-async-queries`) — oxlint has no testing-library plugin. Re-tag to `custom-oxlint-plugin` and write the rule ourselves, OR `manual-review-only` if not high-priority.

Demote `custom-oxlint-plugin` → `manual-review-only` (require dataflow / type info):

- 01:7 (ref-during-render): demote.
- 03-storage:10 (typecheck JSON.stringify arg): demote — TS type info is required.
- 03-offline:1 (verb classification "is this a write"): demote.
- 03-state:8 (zustand `actions` key convention): keep `custom-oxlint-plugin` but mark "convention only".
- 04-battery:8 (paired keep-awake tag-string match across file): simplify rule — flag any `activateKeepAwakeAsync` without ANY `deactivate*` call in the same file; cross-tag string matching is `manual-review-only`.

## Specific oddities to fix

| File           | Old rule                                                                     | Fix                                                                                                                                                                                                                                                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 04-outdoors:7  | `fontWeight ≥ 400`                                                           | **Drop.** Restates RN default (`'normal'` ≈ 400). Adds nothing.                                                                                                                                                                                                                                                                                                |
| 04-outdoors:13 | "test under 100k lux simulated sunlight"                                     | **Soften and re-cite.** Drop the specific lux number unless we have a real source. Reword to: "Every primary screen audited under bright outdoor lighting (use a lightbox or physical-phone field test) before release. Theme-token contrast audit script in CI." Tag `ci-check` + `manual-review-only`.                                                       |
| 05-platform:5  | "mixing `app.json` + `app.config.js` causes the JSON to be silently ignored" | **Correct the claim.** Expo _merges_ `app.config.{js,ts}` _over_ `app.json` when both exist (config returned from the JS file extends/overrides JSON). Reword the rule to: "Pick one — having both is a footgun for stakeholders who edit `app.json` and don't realize `app.config.js` overrides them. CI fails if both files exist with non-trivial overlap." |
| 05-testing:11  | sibling `*.test.tsx` for every route                                         | **Drop.** Per CLAUDE.md "YAGNI ruthlessly." Replace with a coverage threshold rule on changed files only.                                                                                                                                                                                                                                                      |
| 03-state:6     | "React Context only for DI"                                                  | **Add a note.** Theme/i18n providers are explicit DI examples and are allowed.                                                                                                                                                                                                                                                                                 |
| 03-offline:14  | mentions "vector clock"                                                      | **Drop the vector-clock language.** Out of scope; we have no CRDT lib. Replace with a simpler last-write-wins note.                                                                                                                                                                                                                                            |
| 04-battery:13  | half-rule, half-runbook                                                      | **Split.** Lint half stays; runbook half moves to a `manual-review-only` checklist entry.                                                                                                                                                                                                                                                                      |
| 05-a11y:6      | RTL preempt with `I18nManager` import-check                                  | **Drop.** Russian-only UI; rule is speculative. If a future locale forces RTL, revisit.                                                                                                                                                                                                                                                                        |
| 05-testing:1   | "`jest.preset` must be exactly..."                                           | **Reword.** It's the top-level Jest config key `preset`, not `jest.preset`.                                                                                                                                                                                                                                                                                    |
| 05-testing:6   | flag `getByTestId` only when `accessibilityLabel` co-exists                  | **Tighten.** Flag `getByTestId` whenever a role/label query would work — heuristic via paired AST check, otherwise `manual-review-only`.                                                                                                                                                                                                                       |
| 03-storage:1   | rule body has `BANNED:` prefix                                               | **Reformat to match the schema** (no inline severity prefix; the slug name `storage/no-async-storage` carries the "banned" semantics).                                                                                                                                                                                                                         |

## Citation cleanup

The reviewer flagged ~10 citations whose URLs don't actually support the rule. Each agent during patching:

- 01:9, 01:13, 01:14, 01:43 — replace or remove the questionable URL. If no good source exists for a Zustand selector page, cite `https://zustand.docs.pmnd.rs/guides/typescript` or the README.
- 03-offline:13 — remove the SQLite `lang_delete.html` citation; cite a soft-delete pattern from a real source or remove the rule's URL.
- 04-outdoors:13 — see "specific oddities" above.
- 05-testing:8 — replace with a real testing-library guide URL.

For Kent C. Dodds and TkDodo blog posts, keep but note "personal blog" is acceptable since both are recognized practitioners with named credentials (per the original brief's source-quality rule).

## File-level intro consistency

Each topic file (01–05) opens with:

```markdown
# <Topic title — sentence case>

> See [00-reconciliation.md](00-reconciliation.md) for detection modes, slug conventions, and resolution decisions.

<one-paragraph framing>
```

No legend. No "Last updated". No re-explanation of detection modes. The reconciliation memo is the source of truth.

## Out-of-scope for this pass

- Adding new rules.
- Re-running the source verification.
- Authoring the actual oxlint plugins (Phase 2).
- Updating `00-index.md` rule counts (deferred — done after the patch).

## Done when

- All 5 topic files use slug IDs and the 4-mode detection legend.
- Every duplicate group has one canonical home and cross-refs in the others.
- All stack mismatches (RTK Query, expo-av, sentry script) are removed or corrected.
- The five "specific oddities" rules above are fixed or dropped.
- Bad citations are replaced or removed.
- `00-index.md` rule counts updated to reflect drops/merges.
