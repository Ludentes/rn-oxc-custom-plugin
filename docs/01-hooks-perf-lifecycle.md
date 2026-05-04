# Hooks, performance, and async lifecycle

> See [00-reconciliation.md](00-reconciliation.md) for detection modes, slug conventions, and resolution decisions.

This section catalogs the rules that prevent rules-of-hooks crashes (the "Rendered more hooks than during the previous render" class), unbounded JS-thread work, and native-resource leaks across the React/RN/Expo stack: Expo SDK 55, RN 0.83, React 19, expo-router, Zustand, react-query, NativeWind v4. Android-primary, also web.

---

## Hooks & rendering

### hooks/no-conditional-call: Never call a hook after a conditional `return`, inside an `if/for/&&/?:`, or after a thrown error

**Why:** React identifies hooks by call order. Skipping one on render N+1 yields "Rendered more hooks than during the previous render" — the canonical crash that motivated this catalog.
**Detection:** `oxlint-builtin: react-hooks/rules-of-hooks`
**Sources:**

- [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
- [react-hooks/rules-of-hooks](https://www.npmjs.com/package/eslint-plugin-react-hooks)

### hooks/exhaustive-deps: Every hook with a closure dependency must declare a complete deps array — no silent omissions, no `// eslint-disable-next-line`

**Why:** Stale closures read stale state/props; partial deps cause unpredictable async behavior. Disable comments mask real bugs and accumulate.
**Detection:** `oxlint-builtin: react-hooks/exhaustive-deps`. Forbid disable comments via `custom-oxlint-plugin` (AST: `Comment` node with text matching `eslint-disable.*exhaustive-deps`).
**Sources:**

- [useEffect — Specifying reactive dependencies](https://react.dev/reference/react/useEffect#specifying-reactive-dependencies)
- [Removing Effect Dependencies](https://react.dev/learn/removing-effect-dependencies)

### hooks/only-from-react-functions: Hooks may only be called from React function components or other hooks — never from event handlers, class methods, or plain functions

**Why:** Out-of-render calls bypass React's dispatcher and either throw "Invalid hook call" or attach state to the wrong component.
**Detection:** `oxlint-builtin: react-hooks/rules-of-hooks`
**Sources:**

- [Rules of Hooks — Only Call Hooks from React Functions](https://react.dev/reference/rules/rules-of-hooks#only-call-hooks-from-react-functions)

### hooks/use-prefix-naming: Custom hook names must start with `use` and React component names must start with a capital letter

**Why:** The linter and React DevTools rely on this naming to apply Rules of Hooks and to render names; misnamed hooks get treated as plain functions and bypass `hooks/no-conditional-call`.
**Detection:** `manual-review-only`. Note: the previously cited `react/hook-use-state` enforces `useState` destructuring, not naming, so it doesn't actually cover this rule. A future `custom-oxlint-plugin` could check `^use[A-Z]` on identifiers whose body contains `use*` calls, but until then this is review-gated.
**Sources:**

- [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks#hook-names-always-start-with-use)

### hooks/memoize-only-when-identity-observed: Memoize values/callbacks only when downstream identity is observed by a memoized child, a `Context.Provider value=`, or a `FlatList renderItem` paired with a memo'd row

**Why:** This project does **not** have React Compiler enabled yet. Manual `useMemo`/`useCallback` is required only where identity is observed: a `React.memo`-wrapped child whose props include the value, a `<Context.Provider value={...}>`, or a `FlatList`/`FlashList` `renderItem` whose row is memoized. Memoizing derived values inside leaf components is compiler territory and adds runtime overhead today (allocation + dep comparison every render). When React Compiler is enabled in this repo, drop manual memo at the same PR — see `perf/react-compiler-readiness`.
**Detection:** `manual-review-only` (heuristic possible via `custom-oxlint-plugin`: flag `useMemo` whose body is a literal/simple ref expression).
**Sources:**

- [useMemo — Should you add useMemo everywhere?](https://react.dev/reference/react/useMemo#should-you-add-usememo-everywhere)
- [Before You memo() — Dan Abramov](https://overreacted.io/before-you-memo/)

### hooks/memo-needs-memoized-consumer: `useCallback`/`useMemo` are pointless if the consumer is not `React.memo`'d or doesn't use the value as a dep

**Why:** A new `onPress` identity each render only matters if the child skips re-render via `memo` or if the value feeds another hook's deps. Otherwise it's noise.
**Detection:** `manual-review-only`. Partial: `custom-oxlint-plugin` flagging `useCallback` whose result is passed only to native DOM/RN intrinsics (`<View onPress={fn}>`).
**Sources:**

- [useCallback — Should you add useCallback everywhere?](https://react.dev/reference/react/useCallback#should-you-add-usecallback-everywhere)

### hooks/no-ref-during-render: Don't read or write refs (`ref.current`) during render

**Why:** Refs are escape hatches; reading them during render breaks concurrent rendering (offscreen pre-renders, transition restarts) and writing them couples render output to mutable state, producing tearing.
**Detection:** `manual-review-only` (demoted from `custom-oxlint-plugin` — reliable detection requires dataflow analysis to distinguish render-scope `.current` access from event-handler/effect access).
**Sources:**

- [useRef — Do not write or read ref.current during rendering](https://react.dev/reference/react/useRef#caveats)
- [Referencing Values with Refs](https://react.dev/learn/referencing-values-with-refs#best-practices-for-refs)

### hooks/no-index-as-key: Don't use index as `key` in dynamic lists (FlatList `keyExtractor`, `.map`)

**Why:** When items reorder/insert/delete, index keys cause React to mutate the wrong instance — losing input focus, animation state, and triggering bogus prop diffs in `FlatList`.
**Detection:** `oxlint-builtin: react/no-array-index-key`
**Sources:**

- [Rendering Lists — Rules of keys](https://react.dev/learn/rendering-lists#rules-of-keys)
- [FlatList — keyExtractor](https://reactnative.dev/docs/flatlist#keyextractor)

### hooks/no-nested-component-defs: Don't define components inside other components

**Why:** Each parent render creates a brand-new component type → React unmounts/remounts the entire subtree, killing local state, focus, and animations.
**Detection:** `oxlint-builtin: react/no-unstable-nested-components`
**Sources:**

- [Keeping Components Pure](https://react.dev/learn/keeping-components-pure)
- [react/no-unstable-nested-components](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-unstable-nested-components.md)

### hooks/derive-dont-mirror: Derive state from props/state during render — don't mirror it via `useState` + `useEffect`

**Why:** Mirror-state effects cause two renders per change and stale-data windows. Computing the value inline (or with `useMemo` if expensive) is correct.
**Detection:** `manual-review-only`. Heuristic `custom-oxlint-plugin`: flag `useEffect` whose body is a single `setState` call referencing only props/state from the same component.
**Sources:**

- [You Might Not Need an Effect — Updating state based on props or state](https://react.dev/learn/you-might-not-need-an-effect#updating-state-based-on-props-or-state)

### hooks/functional-set-state: Pass functional updaters to `setState` when the new value depends on the previous

**Why:** `setX(x + 1)` inside a closure captured by an effect/event reads stale `x`; `setX(prev => prev + 1)` is always correct and lets you drop the dep.
**Detection:** `manual-review-only` (demoted — reliable detection requires flow analysis to identify whether the setter argument actually depends on the prior state value).
**Sources:**

- [useState — Updating state based on the previous state](https://react.dev/reference/react/useState#updating-state-based-on-the-previous-state)

### hooks/use-id-for-aria: Use `useId` for accessibility/form IDs — never `Math.random()` or module-level counters

**Why:** Random IDs break SSR/hydration on web and produce different IDs per render, breaking `aria-labelledby` linkage. Module counters leak across hot reloads.
**Detection:** `custom-oxlint-plugin` (AST: `CallExpression` to `Math.random` inside a render scope used in an id-shaped JSX attribute).
**Sources:**

- [useId](https://react.dev/reference/react/useId)

### hooks/use-sync-external-store: Use `useSyncExternalStore` (or Zustand's built-in selector hook) for any external mutable source — not `useState` + manual subscribe

**Why:** Manual subscribe-in-effect leaks under concurrent rendering and tears between concurrent renders. `useSyncExternalStore` guarantees consistency.
**Detection:** `manual-review-only`. Flag pattern: `useEffect` body containing `.subscribe(` whose callback calls `setState` — `custom-oxlint-plugin`.
**Sources:**

- [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
- [Zustand — Updating state](https://zustand.docs.pmnd.rs/guides/updating-state)

### hooks/zustand-selector-required: Use Zustand selectors (`useStore(s => s.x)`), never destructure the whole store

**Why:** Destructuring subscribes to every field; any unrelated change re-renders the component. Selectors limit re-render to the slice you read.
**Detection:** `custom-oxlint-plugin` (AST: `CallExpression` to a hook ending `Store` with zero arguments where result is `ObjectPattern`-destructured).
**Sources:**

- [Zustand — Updating state](https://zustand.docs.pmnd.rs/guides/updating-state)

### hooks/no-hooks-in-try-catch: Don't put hooks inside `try`/`catch` — wrap with an ErrorBoundary instead

**Why:** A throw between two hook calls leaves the dispatcher in an inconsistent state; subsequent renders mismatch and crash.
**Detection:** `custom-oxlint-plugin` (AST: `CallExpression` to `use*` whose ancestor is `TryStatement.block`).
**Sources:**

- [Rules of Hooks — Don't call Hooks inside try/catch/finally blocks](https://react.dev/reference/rules/rules-of-hooks)

---

## Performance

### perf/memo-frequent-parents: Wrap pure presentational components passed lots of props with `React.memo`, but only when the parent re-renders frequently

**Why:** `memo` adds a shallow-prop-equality check each render. Useful for list rows and frequently-updating parents; pointless for a screen-level component that renders once.
**Detection:** `manual-review-only` (judgment call).
**Sources:**

- [memo — Reference](https://react.dev/reference/react/memo)

### perf/no-new-literal-prop-to-memo: Never pass new object/array/function literals as props to memoized components

**Why:** Defeats `React.memo`/`PureComponent` shallow equality — every parent render re-renders the child anyway. Common in `style={{...}}` and `data={[...]}`.
**Detection:** `oxlint-builtin: react-perf/jsx-no-new-object-as-prop`, `react-perf/jsx-no-new-array-as-prop`, `react-perf/jsx-no-new-function-as-prop`, `react-perf/jsx-no-jsx-as-prop`
**Sources:**

- [eslint-plugin-react-perf](https://github.com/cvazac/eslint-plugin-react-perf)
- [memo — Caveats](https://react.dev/reference/react/memo#caveats)

### perf/virtualize-lists: Use `FlatList`/`SectionList`/`FlashList` for any list — never `ScrollView` + `.map()` past ~10 items

**Why:** `ScrollView` mounts every child; a 200-row map blocks the JS thread for hundreds of ms on Android. Virtualized lists keep mounted-cell count constant.
**Detection:** `custom-oxlint-plugin` (AST: `JSXElement[name=ScrollView]` containing a child `JSXExpressionContainer` with `.map` whose callee is an array of length unknown — flag all and let reviewer dismiss).
**Sources:**

- [Optimizing FlatList Configuration](https://reactnative.dev/docs/optimizing-flatlist-configuration)
- [Shopify FlashList — Why](https://shopify.github.io/flash-list/docs/fundamentals/usage)

### perf/estimated-item-size-cross-ref: Provide `getItemLayout` / `estimatedItemSize` for sized rows

> Canonical: see [lists/estimated-item-size-required](02-ui-navigation-layout.md#listsestimated-item-size-required).

### perf/reanimated-cross-ref: Animations on the UI thread (Reanimated worklets, ban `Animated.Value`)

> Canonical: see [battery/reanimated-not-animated-api](04-battery-interruptions-outdoors.md#batteryreanimated-not-animated-api).

### perf/suspense-and-transition: Wrap heavy first-render screens in `<Suspense>` and use `startTransition` for navigation-triggered state updates

**Why:** Without transitions, tapping a tab blocks input until the new screen finishes rendering. `startTransition` keeps input responsive and shows the previous UI until ready.
**Detection:** `manual-review-only`.
**Sources:**

- [useTransition](https://react.dev/reference/react/useTransition)
- [Suspense](https://react.dev/reference/react/Suspense)

### perf/defer-non-critical-work: Defer non-critical work to `InteractionManager.runAfterInteractions` or `requestIdleCallback`

**Why:** Running analytics, prefetch, and image decode during a navigation transition causes dropped frames on the way in. Defer until interactions settle.
**Detection:** `manual-review-only`.
**Sources:**

- [InteractionManager](https://reactnative.dev/docs/interactionmanager)
- [Performance Overview](https://reactnative.dev/docs/performance)

### perf/cpu-heavy-off-js-thread: Move CPU-heavy parsing (large JSON, crypto, regex over big strings) off the JS thread — Hermes worker, native module, or stream-parse

**Why:** A 200ms blocking parse drops 12 frames at 60fps. Hermes is fast but single-threaded; the JS thread also runs React render and event handling.
**Detection:** `manual-review-only`. Heuristic: flag `JSON.parse` on responses over a size threshold (`custom-oxlint-plugin` cannot infer size; review-only).
**Sources:**

- [RN Performance — JS Thread](https://reactnative.dev/docs/performance#js-frame-rate-javascript-thread)
- [Hermes — Performance](https://reactnative.dev/docs/hermes)

### perf/react-compiler-readiness: Write components that are idempotent and free of mutation during render so React Compiler can memoize them when enabled

**Why:** The Compiler will auto-memoize pure render bodies, making manual `useMemo`/`useCallback` redundant. In-render mutation breaks the compiler's safety analysis and disables optimization for that file.

**Status:** **Dormant.** This rule is not enforced today — track adherence via `// TODO(react-compiler)` comments at suspicious sites (in-render mutation, unmemoized derived values that the compiler will pick up). When the Compiler is turned on in this repo, sweep the TODO markers in the same PR and remove now-redundant manual memo (see `hooks/memoize-only-when-identity-observed`).

**Detection:** `manual-review-only` (TODO marker convention; not lint-enforced).
**Sources:**

- [React Compiler — Introduction](https://react.dev/learn/react-compiler)
- [Rules of React](https://react.dev/reference/rules)

### perf/no-inline-style-objects: Don't inline `StyleSheet`-equivalent objects in `style={{...}}`; use `StyleSheet.create` or NativeWind `className`

**Why:** Inline style objects are new identities each render → defeats memo and forces RN's prop-diff to walk the whole style tree. `StyleSheet.create` returns stable IDs; NativeWind v4 emits stable atomic styles.
**Detection:** `oxlint-builtin: react-perf/jsx-no-new-object-as-prop` catches the literal case for `style`.
**Sources:**

- [StyleSheet — RN Docs](https://reactnative.dev/docs/stylesheet)
- [NativeWind v4 — Performance](https://www.nativewind.dev/v4/getting-started/expo-router)

### perf/stable-react-query-select: Avoid expensive selectors in `react-query`'s `select` without memoizing — pass a stable `select` reference

**Why:** A new `select` identity recomputes the derived data every render, even when the underlying query data is unchanged.
**Detection:** `manual-review-only`. Heuristic `custom-oxlint-plugin`: flag `useQuery({ select: (...) => ... })` where `select` is an inline arrow.
**Sources:**

- [TanStack Query — Render Optimizations](https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations#tracked-properties)

### perf/freeze-on-blur: Use `freezeOnBlur` (React Navigation) for tab/stack screens that don't need to keep rendering when off-screen

**Why:** Default behavior keeps off-screen screens mounted and re-rendering on store updates. Freezing pauses their render tree, eliminating wasted work.
**Detection:** `manual-review-only`.
**Sources:**

- [React Navigation — freezeOnBlur](https://reactnavigation.org/docs/native-stack-navigator/#freezeonblur)
- [react-native-screens — Freeze](https://github.com/software-mansion/react-native-screens#freeze)

### perf/tune-flatlist-windowing: Set `removeClippedSubviews`, `maxToRenderPerBatch`, `windowSize` for long lists; benchmark before tuning

**Why:** Defaults assume short lists. On long lists they cause both memory bloat (windowSize too high) and visible blank cells (too low).
**Detection:** `manual-review-only`.
**Sources:**

- [Optimizing FlatList Configuration](https://reactnative.dev/docs/optimizing-flatlist-configuration)
- [Callstack — Optimizing FlatList](https://www.callstack.com/blog/the-best-react-native-flatlist-optimization-techniques)

### perf/flatten-android-hierarchy: On Android, avoid nested scrollables and avoid translucent overdraw — flatten view hierarchy

**Why:** Android's view system traverses the hierarchy each frame; deep nesting drops frames on mid-tier devices. Translucent layers cause overdraw which is visible in the GPU profiler.
**Detection:** `manual-review-only` (use Android Studio Layout Inspector / Profile GPU Rendering).
**Sources:**

- [RN Performance — RAM Bundles & Inline Requires](https://reactnative.dev/docs/performance)
- [Android — Reducing overdraw](https://developer.android.com/topic/performance/rendering/overdraw)

---

## Async lifecycle & memory leaks

### lifecycle/effect-cleanup-required: Every `useEffect` that subscribes / opens / starts something must return a cleanup function

**Why:** No cleanup → listeners pile up across remounts, callbacks fire on unmounted components, and you leak native handles (camera, location, BLE).
**Detection:** `custom-oxlint-plugin` (AST: `useEffect(arrow)` where arrow body contains `.addEventListener`/`.subscribe`/`.addListener` and arrow does not `ReturnStatement` a function).
**Sources:**

- [useEffect — Subscribing to events](https://react.dev/reference/react/useEffect#subscribing-to-events)
- [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)

### lifecycle/abort-controller-on-cleanup: Every `useEffect` that runs `fetch`/`api.*`/`axios.*` must abort on cleanup with `AbortController` — never `mountedRef`

**Why:** `mountedRef` only suppresses the `setState`-after-unmount warning — the network call still runs, the response still parses, and JSON-parse / response-body memory is still allocated. `AbortController` actually cancels the work, frees memory, and propagates `signal` into nested fetches and react-query mutation/query functions. Every effect that issues an outbound request — `fetch`, `api.*`, `axios.*` (with `signal`), or a TanStack Query call configured to honor `signal` — must wire its `AbortController` into the request and call `controller.abort()` in the cleanup.

**Related:** see [interruptions/abort-on-background](04-battery-interruptions-outdoors.md#interruptionsabort-on-background) for aborting in-flight work when the app backgrounds (separate trigger, same primitive).

**Detection:** `custom-oxlint-plugin` (AST: `useEffect` whose body calls `fetch(`/`api.`/`axios.` and either lacks `new AbortController()` or fails to pass `controller.signal` to the call; also flag `useRef(true)` paired with cleanup `mounted.current = false`).
**Sources:**

- [useEffect — Fetching data](https://react.dev/reference/react/useEffect#fetching-data-with-effects)
- [MDN — AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [TanStack Query — Query Cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation)

### lifecycle/use-focus-effect-for-screens: Use `useFocusEffect` (expo-router / React Navigation) for screen-scoped subscriptions, not `useEffect`

**Why:** With native-stack screens kept mounted across navigation, `useEffect(() => sub, [])` keeps the subscription alive on hidden screens. `useFocusEffect` runs on focus and cleans up on blur.
**Detection:** `manual-review-only`. Heuristic `custom-oxlint-plugin`: file under `app/` with `useEffect` containing `.addListener(` and empty deps array → suggest `useFocusEffect`.
**Sources:**

- [expo-router — useFocusEffect](https://docs.expo.dev/router/reference/hooks/#usefocuseffect)
- [React Navigation — useFocusEffect](https://reactnavigation.org/docs/use-focus-effect)

### lifecycle/no-remove-all-listeners: Always store the listener token returned by `addListener`/`addEventListener` and remove it in cleanup — never call `removeAllListeners` blindly

**Why:** `removeAllListeners` removes everything, including listeners owned by other components/libs (notifications, deep linking). Token-based removal is surgical.
**Detection:** `custom-oxlint-plugin` (AST: `CallExpression` to `removeAllListeners` with no arguments).
**Sources:**

- [RN — DeviceEventEmitter / NativeEventEmitter](https://reactnative.dev/docs/native-modules-ios#sending-events-to-javascript)

### lifecycle/app-state-cross-ref: Subscribe to `AppState` once at app root

> Canonical: see [interruptions/single-app-state-subscriber](04-battery-interruptions-outdoors.md#interruptionssingle-app-state-subscriber).

### lifecycle/react-query-focus-cross-ref: react-query `focusManager` / `onlineManager` wiring on RN

> Canonical: see [state/react-query-rn-focus-online](03-state-storage-offline.md#statereact-query-rn-focus-online).

### lifecycle/idempotent-cleanup: Cleanup must be idempotent and tolerate "subscription never started" — guard with optional chaining

**Why:** In React 19 strict mode, effects run mount → cleanup → mount in development. A non-idempotent cleanup that assumes a handle exists will throw on the first run.
**Detection:** `manual-review-only`.
**Sources:**

- [Synchronizing with Effects — How to handle the Effect firing twice](https://react.dev/learn/synchronizing-with-effects#how-to-handle-the-effect-firing-twice-in-development)
- [StrictMode](https://react.dev/reference/react/StrictMode)

### lifecycle/no-mounted-ref-antipattern: Don't use `isMounted`/`mountedRef` flags to gate `setState` after async — fix the root cause (cancel the work)

**Why:** This is a well-known antipattern called out by React core: it papers over a leak instead of fixing it. The async work still runs and still allocates. Use `AbortController` (see `lifecycle/abort-controller-on-cleanup`).
**Detection:** `custom-oxlint-plugin` (AST hint shared with `lifecycle/abort-controller-on-cleanup`: `useRef(true)` paired with cleanup `*.current = false`).
**Sources:**

- [isMounted is an Antipattern (React core blog, archived)](https://legacy.reactjs.org/blog/2015/12/16/ismounted-antipattern.html)
- [useEffect — Fetching data](https://react.dev/reference/react/useEffect#fetching-data-with-effects)

### lifecycle/timers-must-clear: Timers (`setTimeout`/`setInterval`) created in effects must be cleared in cleanup, and IDs must not be lost across renders

**Why:** A re-running effect without cleanup spawns timers exponentially. Storing IDs in state (instead of refs) re-triggers the effect and compounds the leak.
**Detection:** `custom-oxlint-plugin` (AST: `useEffect` whose body calls `setTimeout`/`setInterval` and whose return doesn't call the matching `clear*`).
**Sources:**

- [useEffect — Specifying reactive dependencies](https://react.dev/reference/react/useEffect)

### lifecycle/keep-awake-cross-ref: `expo-keep-awake` paired cleanup

> Canonical: see [battery/keep-awake-paired-cleanup](04-battery-interruptions-outdoors.md#batterykeep-awake-paired-cleanup).

### lifecycle/single-owner-sockets: WebSocket / EventSource / polling loops must be tied to a single owner (a hook or store) — not duplicated across mounted screens

**Why:** Each mount opens a socket; backgrounded screens keep them open; servers reject the 6th connection. Centralize in a singleton store, expose status via a selector.
**Detection:** `manual-review-only`. Heuristic `custom-oxlint-plugin`: flag `new WebSocket(` in any file under `app/` (screen scope).
**Sources:**

- [RN — Networking / WebSockets](https://reactnative.dev/docs/network#websocket-support)

### lifecycle/cancel-mutations-on-unmount: Cancel React Query mutations and infinite-query fetches on screen unmount when the result is no longer relevant

**Why:** A logout → re-login mid-mutation can apply the previous user's mutation to the new user's cache. Use `mutation.reset()` and per-screen `QueryClient` scoping or `signal`-aware `mutationFn`.
**Detection:** `manual-review-only`.
**Sources:**

- [TanStack Query — Query Cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation)
- [TanStack Query — Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)

### lifecycle/no-async-effect-top-level: Don't await inside an effect's top level — effects must be sync; wrap async in an inner function and call it

**Why:** Returning a Promise from `useEffect` makes React treat the Promise as the cleanup function and call it as one — silent breakage, no cleanup, console warning.
**Detection:** `custom-oxlint-plugin` (AST: `useEffect(AsyncArrowFunctionExpression)` or `useEffect(AsyncFunctionExpression)`).
**Sources:**

- [useEffect — Caveats](https://react.dev/reference/react/useEffect#caveats)

### lifecycle/no-deprecated-remove-listener: Keyboard, orientation, and dimension listeners must be registered through the modern subscription API (return value `.remove()`), not the deprecated `removeListener`

**Why:** `removeListener` was deprecated in RN 0.65 and removed in subsequent releases. Code calling it is silently broken; listeners stay attached forever.
**Detection:** `custom-oxlint-plugin` (AST: `MemberExpression` named `removeListener` on `Keyboard`/`Dimensions`/`AppState`).
**Sources:**

- [RN 0.65 release notes](https://reactnative.dev/blog/2021/08/26/0.65-release)
- [Keyboard API](https://reactnative.dev/docs/keyboard)

### lifecycle/timeout-long-native-subs: Long-running native subscriptions (BLE scan, camera session, location) must have an explicit timeout or backoff — don't leave them on indefinitely

**Why:** Forgotten scans drain battery in minutes on Android and trip Doze-mode kills, after which silent reconnect logic compounds the leak.
**Detection:** `manual-review-only`.
**Sources:**

- [Android — Doze and App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby)
- [Expo — BackgroundFetch](https://docs.expo.dev/versions/latest/sdk/background-fetch/)
