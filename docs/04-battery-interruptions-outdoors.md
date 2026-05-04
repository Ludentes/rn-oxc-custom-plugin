# Battery, interruptions, and outdoors

> See [00-reconciliation.md](00-reconciliation.md) for detection modes, slug conventions, and resolution decisions.

Real-world mobile scenarios for an Android-primary Expo SDK 55 / RN 0.83 app whose users are outdoors (sunlight, gloves, sweat) and on cellular. Android Doze + phone calls + audio focus loss are routine for any such app — these rules harden against them.

## Battery & energy efficiency

### battery/location-default-balanced: Default `expo-location` to `Accuracy.Balanced`; require explicit allow-listing for `High`/`Highest`/`BestForNavigation`

**Why:** `Accuracy.High` (~10 m) and `BestForNavigation` engage GPS + IMU and are the dominant battery cost on Android during a polling-station lookup. `Balanced` (~100 m) is enough to map a citizen to a precinct and avoids GPS where Wi-Fi/cell triangulation suffices.
**Detection:** `custom-oxlint-plugin` — flag any `MemberExpression` matching `Accuracy.(High|Highest|BestForNavigation)` outside an explicit allow-list (`src/lib/location/highAccuracy.ts`).
**Sources:**

- [expo-location: Accuracy](https://docs.expo.dev/versions/latest/sdk/location/#accuracy)
- [Apple — Energy Efficiency Guide for iOS Apps: Location](https://developer.apple.com/library/archive/documentation/Performance/Conceptual/EnergyGuide-iOS/LocationBestPractices.html)

### battery/watch-position-throttle-required: Never call `watchPositionAsync` without a `distanceInterval` AND `timeInterval` floor

**Why:** Without throttles, watchers fire every fix the OS produces, draining battery on cellular. For an electoral-info app a 50 m / 30 s floor is plenty.
**Detection:** `custom-oxlint-plugin` — when a call to `Location.watchPositionAsync` is found, require the options object literal to contain both `timeInterval` (>= 30000) and `distanceInterval` (>= 25) properties.
**Sources:**

- [expo-location: watchPositionAsync](https://docs.expo.dev/versions/latest/sdk/location/#locationwatchpositionasyncoptions-callback)

### battery/reanimated-not-animated-api: Use Reanimated worklets for all per-frame animations; never animate via JS-thread `Animated.Value`

**Why:** A JS-thread animation under battery saver can drop to 15 fps and forces the JS bridge to wake every frame. Worklets run on the UI thread and let the JS thread sleep — a measurable battery win on 60 Hz scrolls. (Canonical home; file 01 cross-references here.)
**Detection:** `custom-oxlint-plugin` — flag `Animated.Value`/`Animated.timing` imported from `react-native` (prefer `react-native-reanimated`); flag `setInterval` callers that touch `setState` at intervals < 250 ms.
**Sources:**

- [Reanimated — Worklets](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/worklets)
- [React Native — Performance](https://reactnative.dev/docs/performance)

### battery/setinterval-gated-by-appstate: `setInterval` shorter than 60 s must be gated by `AppState === 'active'`

**Why:** A 5 s poller that keeps running while the app is backgrounded burns radio + CPU during Doze maintenance windows and prevents App Standby from kicking in. Citizens leave the app open in their pocket for hours.
**Detection:** `custom-oxlint-plugin` — when `setInterval(fn, ms)` has `ms < 60000`, require an `AppState`/`useAppState` reference in the same scope.
**Sources:**

- [Android — Doze and App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby)
- [React Native — AppState](https://reactnative.dev/docs/appstate)

### battery/batch-network-reads: Batch network reads — never fan out single-row HTTP GETs in a loop

**Why:** iOS and Android both throttle background networking; many short connections cost more energy than one larger payload because the cellular radio cannot tail-down between requests.
**Detection:** `custom-oxlint-plugin` — flag `await fetch(...)` inside `for`/`while` loops or inside `.map(async ...)`. Suggest `Promise.all` + a batch endpoint.
**Sources:**

- [Apple — Minimize Networking](https://developer.apple.com/library/archive/documentation/Performance/Conceptual/EnergyGuide-iOS/MinimizeNetworkingAndCommunication.html)
- [Android — Optimize for Doze and App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby#assessing_your_app)

### battery/background-fetch-min-interval-900s: `expo-background-fetch` `minimumInterval` must be ≥ 900 s and code must treat it as a hint

**Why:** iOS only schedules background fetches when it predicts the app will be useful; Android similarly defers. Setting 60 s is a no-op and gives engineers a false sense the data is fresh.
**Detection:** `custom-oxlint-plugin` — flag `BackgroundFetch.registerTaskAsync(_, { minimumInterval })` literals where `minimumInterval < 900`.
**Sources:**

- [expo-background-fetch](https://docs.expo.dev/versions/latest/sdk/background-fetch/)
- [Apple — Background Tasks](https://developer.apple.com/documentation/backgroundtasks)

### battery/task-manager-define-at-module-top: Define every `TaskManager.defineTask` at module top level — never inside React effects/components

**Why:** Background execution spins up the JS runtime without mounting React; tasks defined inside `useEffect` are simply never registered, silently failing in the field where you cannot see logs.
**Detection:** `custom-oxlint-plugin` — flag `TaskManager.defineTask` calls whose enclosing function is not the module top level.
**Sources:**

- [expo-task-manager](https://docs.expo.dev/versions/latest/sdk/task-manager/)

### battery/keep-awake-paired-cleanup: Never hold a `useKeepAwake`/`activateKeepAwakeAsync` lock outside an explicit interactive screen

**Why:** A leaked keep-awake holds the screen on at full brightness — the single biggest battery drain on a phone. Outdoor brightness ramps to maximum and burns ~1%/min. (Canonical home; file 01 cross-references here.)
**Detection:** `custom-oxlint-plugin` — flag any `activateKeepAwakeAsync` in a file that contains no `deactivateKeepAwake`/`deactivateKeepAwakeAsync` call. (Cross-tag string-pair matching is too brittle for static analysis — that check is `manual-review-only`.) Require `useKeepAwake` only in screens listed in `src/lib/keepAwakeAllowList.ts`.
**Sources:**

- [expo-keep-awake](https://docs.expo.dev/versions/latest/sdk/keep-awake/)
- [Android — PowerManager / Wake Locks](https://developer.android.com/training/scheduling/wakelock)

### battery/respect-low-power-mode: Skip non-essential renders when `Battery.lowPowerMode` is true

**Why:** Confetti, polling-station map clustering, and chart re-renders cost watts. Honoring Low Power Mode (iOS) and battery saver (Android) is a measurable user-trust win.
**Detection:** `manual-review-only` — review checklist gate: every animation/chart component must reference `Battery.useBatteryState()` or pass through `useReducedMotion`.
**Sources:**

- [expo-battery — lowPowerMode](https://docs.expo.dev/versions/latest/sdk/battery/)
- [Apple HIG — Reduce motion](https://developer.apple.com/design/human-interface-guidelines/accessibility#Motion)

### battery/expo-image-decode-cost: Decoding cost of RN `Image` in lists drives thermal throttling

**Why:** RN's stock `Image` re-decodes on every mount and does not share a memory cache; in long lists that is the dominant CPU cost on cheap Androids and triggers thermal throttling outdoors. The canonical ban + replacement rule lives elsewhere.

> See [images/expo-image-required](02-ui-navigation-layout.md#imagesexpo-image-required) for the canonical rule.

### battery/foreground-service-for-critical-uploads: Long-running work that must not be killed needs a foreground service (Android) — do not rely on `expo-background-fetch`

**Why:** Background-fetch is killed at OS discretion; a citizen's "I'm at the polling station, sync my report" workflow needs an explicit foreground service with a persistent notification.
**Detection:** `manual-review-only` — code review gate. Add a checklist line: "Does this workflow tolerate Doze killing it within 30 s? If not, use foreground service."
**Sources:**

- [Android — Foreground services](https://developer.android.com/develop/background-work/services/foreground-services)
- [Android — Background execution limits](https://developer.android.com/about/versions/oreo/background)

### battery/fcm-high-priority-for-data-sync: Every push notification used for data sync must be FCM high-priority — not silent timer-based polling

**Why:** Doze blocks AlarmManager and JobScheduler; only FCM high-priority can wake an idle device for time-critical updates (e.g., precinct reassignment morning of election day).
**Detection:** `manual-review-only` — backend code review.
**Sources:**

- [Android — Doze (FCM exception)](https://developer.android.com/training/monitoring-device-state/doze-standby#whitelisting-cases)
- [FCM — Setting message priority](https://firebase.google.com/docs/cloud-messaging/concept-options#setting-the-priority-of-a-message)

### battery/background-work-config-gate: Lint and runbook gate on background-work configuration changes

**Why:** Battery regressions are invisible to QA on a charged dev device. Changes to background-work config (`UIBackgroundModes`, Android `<service>` entries) must trip an explicit review.
**Detection:**

- `ci-check` — lintable half: refuse PRs that change `app.config.js`/`app.config.ts` `UIBackgroundModes` or Android `<service>` entries without a Battery Historian artifact attached.
- `manual-review-only` — release-runbook checklist entry: profile with Battery Historian against a real overnight `bugreport` before any release that touches background work.
  **Sources:**
- [Android — Battery Historian](https://developer.android.com/topic/performance/power/battery-historian)

---

## Interruptions

### interruptions/single-app-state-subscriber: Subscribe to `AppState` exactly once per app, in a top-level provider

**Why:** Each `addEventListener('change', …)` call leaks if not cleaned up. Multiple subscribers also re-trigger save logic on every transition, multiplying disk writes during a phone-call interruption. (Canonical home; file 01 cross-references here.)
**Detection:** `custom-oxlint-plugin` — flag `AppState.addEventListener` calls outside `src/providers/AppStateProvider.tsx`. The single subscription is propagated to consumers via context/store.
**Sources:**

- [React Native — AppState](https://reactnative.dev/docs/appstate)

### interruptions/persist-form-state-on-background: Persist in-flight form state on every transition to `inactive`/`background`

**Why:** iOS `inactive` fires on incoming calls, Control Center pulls, and FaceID prompts — all routine in the field. Losing a half-finished violation report because a call came in is a trust-killer.
**Detection:** `custom-oxlint-plugin` — every `<Form>` or hook with `useFormState` must register a save handler via `useAutosaveOnBackground` (custom hook). Lint flags forms without it.
**Sources:**

- [React Native — AppState states](https://reactnative.dev/docs/appstate#states)
- [Apple — Preparing your UI to run in the background](https://developer.apple.com/documentation/uikit/app_and_environment/scenes/preparing_your_ui_to_run_in_the_background)

### interruptions/treat-inactive-as-background: Treat `inactive` (iOS) the same as `background` for save-work purposes — never as a no-op

**Why:** `inactive` is the only signal you get before iOS suspends; if you wait for `background` you may be deferred indefinitely. Android collapses these into one transition, so a single "leaving foreground" handler matters.
**Detection:** `custom-oxlint-plugin` — flag `if (state === 'background')` without a sibling `=== 'inactive'` branch in app-state handlers.
**Sources:**

- [React Native — AppState](https://reactnative.dev/docs/appstate#app-states)

### interruptions/abort-on-background: Cancel in-flight `fetch` requests on background transition with `AbortController`

**Why:** iOS suspends the JS runtime within ~5 s of `background`. Pending fetches will reject on resume, leaving stale Tanstack Query state. Aborting on `background` and re-issuing on `active` is correct. This rule covers the AppState-transition trigger; the general "abort fetches on effect cleanup" rule lives in file 01.

Related: see [lifecycle/abort-controller-on-cleanup](01-hooks-perf-lifecycle.md#lifecycleabort-controller-on-cleanup).

**Detection:** `custom-oxlint-plugin` — every `AppState` handler that owns long-lived fetches must dispatch `controller.abort()` on `background`/`inactive` transitions; every `fetch(` call inside a hook must pass `signal:` or use Tanstack Query's automatic abort.
**Sources:**

- [MDN — AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [React Native — AppState](https://reactnative.dev/docs/appstate)

### interruptions/audio-interruption-mode: Use `expo-audio` `setAudioModeAsync` with a non-`MixWithOthers` interruption mode for tutorial audio

**Why:** `MixWithOthers` keeps the tutorial voice playing under a phone call — disorienting and against AVAudioSession guidance. The default category should yield to telephony. SDK 55 ships `expo-audio` as the canonical package; `expo-av` is being phased out.
**Detection:** `custom-oxlint-plugin` — when `setAudioModeAsync` (from `expo-audio`) is called, require `interruptionModeIOS` to be `'doNotMix'` or `'duckOthers'` (banlist `'mixWithOthers'`).
**Sources:**

- [expo-audio — setAudioModeAsync](https://docs.expo.dev/versions/latest/sdk/audio/)
- [Apple — AVAudioSession categories](https://developer.apple.com/documentation/avfaudio/avaudiosession/category)

### interruptions/audio-focus-android: Handle Android audio focus loss explicitly — pause on `LOSS_TRANSIENT`, duck on `CAN_DUCK`

**Why:** Citizens often have nav directions or music playing while reading polling info. Failing to release audio focus when our tutorial plays causes their nav app to stop and not resume. Use `expo-audio` (and `expo-video` for video surfaces) — `expo-av` is deprecated in SDK 55.
**Detection:** `custom-oxlint-plugin` — require an `onAudioInterruption`/audio-focus handler on every `expo-audio` player and `expo-video` `<VideoView>` mount.
**Sources:**

- [Android — Audio focus](https://developer.android.com/media/optimize/audio-focus)
- [expo-audio](https://docs.expo.dev/versions/latest/sdk/audio/)
- [expo-video](https://docs.expo.dev/versions/latest/sdk/video/)

### interruptions/headphone-unplug-pause: Headphone unplug must pause media — do not auto-resume on re-plug

**Why:** Apple HIG and Material both require pause on disconnect. Auto-resume blasts audio publicly when the user unplugs in a quiet environment.
**Detection:** `manual-review-only` — manual QA scenario in release checklist.
**Sources:**

- [Apple — Responding to Audio Route Changes](https://developer.apple.com/documentation/avfaudio/responding_to_audio_session_route_changes)
- [Android — Handle audio output changes](https://developer.android.com/media/optimize/audio-focus#becoming_noisy)

### interruptions/idempotency-key-on-submission: Submission flows must carry a client-generated idempotency key

**Why:** A phone call can suspend mid-POST; on resume the user retries and the server gets a duplicate report.

> See [offline/idempotency-key-required](03-state-storage-offline.md#offlineidempotency-key-required) for the canonical rule.

### interruptions/long-uploads-foreground-service: Long uploads must run inside a foreground service, not the JS bridge

**Why:** Reporting a violation video (50 MB on cellular) takes minutes; iOS will suspend the JS context and Android will kill the process under memory pressure during a phone call. A foreground service with a persistent notification survives.
**Detection:** `manual-review-only` — design checklist; uploads >5 MB must use `expo-background-task` or a native module wrapping `WorkManager` with `setForeground`.
**Sources:**

- [Android — WorkManager & long-running work](https://developer.android.com/develop/background-work/background-tasks/persistent/how-to/long-running)
- [Android — Background Execution Limits](https://developer.android.com/about/versions/oreo/background)

### interruptions/no-call-detection-lib: Do not rely on `react-native-call-detection` — use AppState `inactive` as the signal

**Why:** `react-native-call-detection` requires `READ_PHONE_STATE`, which Play Store flags as a sensitive permission for non-dialer apps. Most call interruptions surface as `AppState === 'inactive'` on iOS and `blur` on Android — sufficient signal without the permission.
**Detection:** `custom-oxlint-plugin` — ban `import` of `react-native-call-detection`.
**Sources:**

- [Play Console — Phone permissions policy](https://support.google.com/googleplay/android-developer/answer/10208820)
- [React Native — AppState focus/blur](https://reactnative.dev/docs/appstate#focus-android)

### interruptions/state-machine-replayable: Every state-machine transition triggered by an interruption must be replayable from local storage

**Why:** Suspension can happen between "I pressed Submit" and "request acknowledged". The state machine on resume must read durable state, not in-memory.
**Detection:** `manual-review-only` — code review checklist for any XState/Zustand machine that touches network.
**Sources:**

- [Apple — App lifecycle](https://developer.apple.com/documentation/uikit/app_and_environment/managing_your_app_s_life_cycle)

### interruptions/resuming-ui-on-active: Show explicit "Resuming…" UI on `active` transition when in-flight work was interrupted

**Why:** Field UX testing shows users abandon if a half-completed action looks frozen. A 1-second "Resuming submission…" toast prevents double-taps.
**Detection:** `manual-review-only` — design-handoff checklist gate.
**Sources:**

- [Apple HIG — Loading](https://developer.apple.com/design/human-interface-guidelines/loading)
- [Material — Progress indicators](https://m3.material.io/components/progress-indicators/overview)

---

## Outdoors / sunlight

App is field-used by citizens checking polling station info outdoors. Sunlight readability and one-handed-with-gloves operation drive these rules. Default theme is light; auto-dark is intentionally OFF.

### outdoors/min-contrast-7-1: Body text on primary surfaces must hit WCAG AAA contrast ≥ 7.0:1

**Why:** Sunlight + smudged screens drop perceived contrast by ~50%. AA's 4.5:1 fails outdoors. WCAG AAA is the only published threshold close to outdoor reality.
**Detection:** `manual-review-only` + `ci-check` — design-handoff: a Storybook a11y addon (`@storybook/addon-a11y`) configured to fail on AAA. Tokens reviewed against AAA manually.
**Sources:**

- [WCAG 2.2 — SC 1.4.6 Contrast (Enhanced)](https://www.w3.org/TR/WCAG22/#contrast-enhanced)
- [WCAG 2.2 — SC 1.4.3 Contrast (Minimum)](https://www.w3.org/TR/WCAG22/#contrast-minimum)

### outdoors/no-hex-literals-in-components: Ban raw hex/rgb/hsl color literals in component files — colors must come from `theme.colors`

**Why:** Raw `#888` slipped into a chip is invisible to design review and skips contrast audit. Token-only enforcement is the only scalable defense.
**Detection:** `custom-oxlint-plugin` — flag string literals matching `/^#[0-9a-f]{3,8}$/i` or `rgb(`/`hsl(` in `**/*.tsx` outside `theme/**`.
**Sources:**

- [Material — Design tokens](https://m3.material.io/foundations/design-tokens/overview)
- [Apple HIG — Color](https://developer.apple.com/design/human-interface-guidelines/color)

### outdoors/non-text-contrast-3-1: Non-text UI (icons, focus rings, chart strokes) must hit ≥ 3.0:1 contrast

**Why:** A pale-grey unselected tab outdoors looks identical to background. WCAG SC 1.4.11 specifies 3:1 for meaningful graphics.
**Detection:** `manual-review-only` — Storybook a11y test rule `non-text-contrast`.
**Sources:**

- [WCAG 2.2 — SC 1.4.11 Non-text Contrast](https://www.w3.org/TR/WCAG22/#non-text-contrast)

### outdoors/light-default-no-auto-dark: Default theme is light; auto-dark is NOT enabled

**Why:** Outdoors, dark mode loses ~3 stops of effective contrast (dark text-on-darker glare-mirror). For an info app used in daylight, the default theme is **light** (optimized for outdoor sun). Auto-switching to dark based on `useColorScheme()` / system preference is a known sunlight-readability footgun for our use case and is **not** enabled. If a future product decision adds a manual-only dark theme (never auto), surfaces use `#0a0a0a` (not pure black — pure black smears on AMOLED in motion) and dark surfaces that need brightness use ≤ 95% luminance to reduce glare.
**Detection:** `custom-oxlint-plugin` — require app root `<ThemeProvider>` to receive an explicit `mode` prop; ban `useColorScheme()` as the source of theme mode in app shell. Ban `#000`/`#000000` literals in theme files; require named tokens (e.g., `colors.surface.dark`).
**Sources:**

- [Apple HIG — Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)
- [Material — Dark theme](https://m3.material.io/styles/color/dark-theme)

### outdoors/min-font-size-tokens: Body text minimum 16 sp / 17 pt; metadata minimum 14 sp / 13 pt

**Why:** 12 sp is unreadable in sunlight at arm's length. Apple HIG defines 17 pt body baseline; Material recommends 14 sp minimum for body.
**Detection:** `custom-oxlint-plugin` — ban numeric `fontSize` < 14 in style objects; require `theme.typography.*` tokens.
**Sources:**

- [Apple HIG — Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Material — Typography](https://m3.material.io/styles/typography/overview)

### outdoors/min-touch-target-48dp: Touch targets ≥ 48 dp × 48 dp (44 dp iOS HIG hard floor)

**Why:** Sweaty fingers, gloves, walking — a 32 dp icon button is unhittable. Material requires 48 dp minimum (Android-primary baseline). Apple HIG specifies 44 pt as a hard floor; we never go below 44.
**Detection:** `custom-oxlint-plugin` — require any `<Pressable>`/`<TouchableOpacity>` with an icon-only child to wrap a `hitSlop` totaling ≥ 48 dp; or to declare `minWidth`/`minHeight` ≥ 48. Flag any explicit dimension `< 48`; flag anything `< 44` as an error.
**Sources:**

- [Material — Accessibility (touch targets)](https://m3.material.io/foundations/accessibility/overview)
- [Apple HIG — Layout (44 pt minimum)](https://developer.apple.com/design/human-interface-guidelines/layout)

### outdoors/touch-target-spacing-8dp: Spacing between adjacent tap targets ≥ 8 dp

**Why:** Adjacent buttons that satisfy 48 dp individually but touch each other still produce mis-taps with sweaty fingers.
**Detection:** `manual-review-only` — design checklist; we cannot statically verify computed layout adjacency.
**Sources:**

- [Material — Touch target spacing](https://m3.material.io/foundations/accessibility/overview)

### outdoors/explicit-status-bar-style: Every screen sets `<StatusBar style="dark"|"light"|"auto" />` from `expo-status-bar`

**Why:** A translucent default status bar over a brand-color hero washes out the time/battery icons in sunlight, hiding the very signals citizens need (signal strength, battery). The canonical StatusBar API is `expo-status-bar`; the `react-native` `StatusBar` is banned (see [images/no-rn-statusbar](02-ui-navigation-layout.md#imagesno-rn-statusbar)).
**Detection:** `custom-oxlint-plugin` — every screen file must contain an `<StatusBar style="..." />` element imported from `expo-status-bar`, with `style` set to a string literal `"dark"`, `"light"`, or `"auto"`.
**Sources:**

- [expo-status-bar](https://docs.expo.dev/versions/latest/sdk/status-bar/)
- [Apple HIG — Status bars](https://developer.apple.com/design/human-interface-guidelines/status-bars)
- [Android — System bars](https://developer.android.com/develop/ui/views/layout/edge-to-edge)

### outdoors/scoped-brightness-boost: Boost screen brightness via `expo-brightness` only on screens that need it

**Why:** Forcing brightness for the whole app cooks the battery and overheats the device, throttling CPU outdoors. Scoped boosts (QR display, polling map) recover when the user navigates back.
**Detection:** `custom-oxlint-plugin` — require `Brightness.setBrightnessAsync` / `useBrightness(1.0)` to be paired with cleanup on unmount; ban it in app root.
**Sources:**

- [expo-brightness](https://docs.expo.dev/versions/latest/sdk/brightness/)

### outdoors/no-color-only-encoding: Every state must also use shape, icon, or label — never color alone

**Why:** Sunlight desaturates color perception; a green vs red badge becomes indistinguishable. Required by WCAG 1.4.1 and reinforced by Material.
**Detection:** `manual-review-only` — design-review checklist line: "Is every status conveyed by something other than color?"
**Sources:**

- [WCAG 2.2 — SC 1.4.1 Use of Color](https://www.w3.org/TR/WCAG22/#use-of-color)
- [Material — Accessibility (color)](https://m3.material.io/foundations/accessibility/overview)

### outdoors/sunlight-readability-audit: Audit primary screens under bright outdoor lighting and run a contrast-token CI script

**Why:** Designers review on a 300-nit office monitor at ~200 lux. A polling-station list that "looks fine" in the studio can be illegible in actual sunlight.
**Detection:**

- `manual-review-only` — every primary screen audited under bright outdoor lighting (use a lightbox or physical-phone field test) before release.
- `ci-check` — CI runs a theme-token contrast audit script (≥ 7:1 for body text, ≥ 4.5:1 for non-text/large text, ≥ 3:1 for active controls); fail on regression.
  **Sources:**
- [WCAG 2.2 — Understanding Contrast (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html)
- [Apple HIG — Color (legibility)](https://developer.apple.com/design/human-interface-guidelines/color)

### outdoors/high-contrast-mode-toggle: Provide a one-tap "high-contrast outdoor mode" toggle in settings (separate from system dark-mode preference)

**Why:** Even AAA contrast can fail in direct noon sun. Letting the user invert to pure white-on-black + bumped font size is a documented field-research win. The toggle is **user-initiated only** and is independent of the system dark-mode preference.
**Detection:** `manual-review-only` — feature presence check on settings screen.
**Sources:**

- [Apple HIG — Accessibility (Increase Contrast)](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Material — Accessibility settings](https://m3.material.io/foundations/accessibility/overview)
