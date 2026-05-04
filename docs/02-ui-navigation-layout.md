# Lists, navigation, and layout

> See [00-reconciliation.md](00-reconciliation.md) for detection modes, slug conventions, and resolution decisions.

Scope: Expo SDK 55 / RN 0.83 / React 19 / expo-router / NativeWind v4. Android primary, web secondary. Detection notes target oxlint's JS plugin alpha (March 2026); custom rules are AST-level.

---

## Lists & images

### lists/no-virtualized-in-scrollview: Never wrap a virtualized list in a `ScrollView`

**Why:** Putting `FlatList`, `FlashList`, or `SectionList` inside a `ScrollView` of the same orientation disables windowing — every row mounts at once, defeating recycling and blowing memory on long lists.
**Detection:** `manual-review-only` — JSX ancestor inference across components requires cross-component dataflow that an AST-only oxlint plugin cannot do reliably.
**Sources:**

- [React Native — Optimizing FlatList configuration](https://reactnative.dev/docs/optimizing-flatlist-configuration)
- [FlashList — Known issues](https://shopify.github.io/flash-list/docs/known-issues/)

### lists/key-extractor-required: Always pass an explicit `keyExtractor` returning a stable, unique string

**Why:** Without a stable key, list diffing falls back to array index, causing wrong-row updates, lost focus/state on reorder, and unnecessary re-renders. Index-as-key is the canonical anti-pattern.
**Detection:** `custom-oxlint-plugin` — require a `keyExtractor` prop on `FlatList` / `SectionList` / `FlashList` JSX elements; reject `(_, i) => i.toString()` and similar index-based forms.
**Sources:**

- [React Native — Optimizing FlatList configuration](https://reactnative.dev/docs/optimizing-flatlist-configuration)
- [eslint-plugin-react — no-array-index-key](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-array-index-key.md)

### lists/no-key-on-flashlist-rows: Forbid the `key` prop on FlashList row components and their children

**Why:** Adding a changing `key` to a FlashList item breaks RecyclerListView's recycling — React treats the subtree as new on every scroll, erasing FlashList's perf advantage.
**Detection:** `custom-oxlint-plugin` — inside any function returned to `renderItem` of `FlashList`, ban JSX `key=` props on the root or descendants.
**Sources:**

- [FlashList — Writing performant components](https://shopify.github.io/flash-list/docs/fundamentals/performant-components/)
- [FlashList — Usage](https://shopify.github.io/flash-list/docs/usage/)

### perf/memoize-list-row-and-render-item: Memoize `renderItem` only when the row component is `React.memo`'d

**Why:** A new `renderItem` reference on every parent render forces every visible cell to re-render — but only if the row component is memoized. When the row component is wrapped in `React.memo`, also memoize `renderItem` (with `useCallback`). Otherwise, don't bother — unmemoized rows re-render anyway, and adding `useCallback` is cargo-cult.

Pairs with [hooks/memoize-only-when-identity-observed](01-hooks-perf-lifecycle.md#hooksmemoize-only-when-identity-observed).

**Detection:** `custom-oxlint-plugin` — when a list's `renderItem` returns a JSX element whose component identifier is imported from a file that exports it via `React.memo(...)`, require the `renderItem` callback to be wrapped in `useCallback`. Otherwise no warning.
**Sources:**

- [React Native — Optimizing FlatList configuration](https://reactnative.dev/docs/optimizing-flatlist-configuration)
- [FlashList — Writing performant components](https://shopify.github.io/flash-list/docs/fundamentals/performant-components/)

### lists/get-item-type-on-heterogeneous: Provide `getItemType` on FlashList whenever rows have heterogeneous shapes

**Why:** Without `getItemType`, FlashList recycles a header view into an image cell, causing layout shifts and a one-frame flash of the wrong layout.
**Detection:** `manual-review-only` — semantic; lint cannot infer "heterogeneous".
**Sources:**

- [FlashList — Writing performant components](https://shopify.github.io/flash-list/docs/fundamentals/performant-components/)
- [Shopify Engineering — FlashList v2](https://shopify.engineering/flashlist-v2)

### lists/estimated-item-size-required: Size virtualized list rows — `estimatedItemSize` on FlashList, `getItemLayout` on FlatList when fixed

**Why:** FlashList requires `estimatedItemSize` to pre-allocate cells; missing it forces synchronous measurement and wipes recycler perf. For `FlatList` with known fixed row height, `getItemLayout` skips async measurement and enables instant `scrollToIndex` — but a wrong value yields stuck scroll position and missing rows, so use it only when row height is fixed and verified.

This rule is the canonical home for "sized rows" — file 01's perf section cross-references here.

**Detection:** `custom-oxlint-plugin` for FlashList — require `estimatedItemSize` prop on every `<FlashList>` JSX element. `manual-review-only` for `getItemLayout` (correctness depends on style/runtime).
**Sources:**

- [FlashList — Usage](https://shopify.github.io/flash-list/docs/usage/)
- [React Native — Optimizing FlatList configuration](https://reactnative.dev/docs/optimizing-flatlist-configuration)
- [React Native — FlatList](https://reactnative.dev/docs/flatlist)

### images/expo-image-required: Do not import `Image` from `react-native`; use `expo-image` everywhere

**Why:** RN core `Image` lacks disk caching, blurhash placeholders, recycling-key support, and animated-image handling — leads to network re-fetches, flicker, and OOM on large galleries. It also re-decodes on every mount, burning CPU and battery during scroll; `expo-image` decodes once and reuses, which is the canonical battery-friendly choice on Android.

This rule is the canonical home — file 04's battery section cross-references here.

**Detection:** `oxlint-builtin: eslint/no-restricted-imports` configured to forbid the `Image` named import from `react-native`.
**Sources:**

- [Expo — expo-image](https://docs.expo.dev/versions/latest/sdk/image/)
- [Expo — Image component reference](https://docs.expo.dev/versions/latest/sdk/image/#api)

### images/recycling-key-in-virtualized: Pass `recyclingKey` to `expo-image` inside any virtualized list

**Why:** Without `recyclingKey`, recycled cells briefly show the previous row's image while the new URL loads — the "wrong avatar flash."
**Detection:** `custom-oxlint-plugin` — inside `renderItem` of `FlatList`/`FlashList`/`SectionList`, require `recyclingKey` on `<Image>` from `expo-image`.
**Sources:**

- [Expo — expo-image](https://docs.expo.dev/versions/latest/sdk/image/)

### images/placeholder-content-fit-match: Always set both `placeholder` and `placeholderContentFit` matching `contentFit`

**Why:** A missing placeholder creates a blank gap during load; mismatched `placeholderContentFit` causes a visible "jump" when the real image swaps in (default placeholder fit is `scale-down`, not `cover`).
**Detection:** `custom-oxlint-plugin` — when `<Image>` from `expo-image` has `contentFit`, require matching `placeholderContentFit` and a non-empty `placeholder`.
**Sources:**

- [Expo — expo-image (placeholder)](https://docs.expo.dev/versions/latest/sdk/image/)

### images/prefetch-above-the-fold: Use `Image.prefetch(urls, 'memory-disk')` for images known above the fold before navigation

**Why:** Prefetching off the JS thread hides the network round-trip; without it, the next screen renders empty placeholders for hundreds of ms.
**Detection:** `manual-review-only`.
**Sources:**

- [Expo — expo-image prefetch](https://docs.expo.dev/versions/latest/sdk/image/)

### images/explicit-cache-policy: Set explicit `cachePolicy` on `expo-image`

**Why:** Default is `disk`; pick `memory-disk` for hot lists, `none` for one-shot QR/captcha. Defaulting blindly leaks disk for ephemeral images and re-decodes hot images on every scroll.
**Detection:** `custom-oxlint-plugin` — require `cachePolicy` prop on every `<Image>` from `expo-image` (style-rule, not bug rule).
**Sources:**

- [Expo — expo-image cachePolicy](https://docs.expo.dev/versions/latest/sdk/image/)

### images/static-assets-via-require: Static assets must be loaded via `require()` and (optionally) preloaded with `Asset.loadAsync`

**Why:** Remote URLs for bundled assets break offline use and inflate first-render time; unloaded assets cause a one-frame blank on first display.
**Detection:** `custom-oxlint-plugin` — flag `<Image source={{ uri: 'http…/assets/…' }} />` patterns referencing files that exist in `/assets`.
**Sources:**

- [Expo — Asset](https://docs.expo.dev/versions/latest/sdk/asset/)
- [Expo — Preloading assets](https://docs.expo.dev/develop/user-interface/assets/)

### lists/tune-windowing-only-with-cause: Tune `windowSize`, `maxToRenderPerBatch`, and `initialNumToRender` only with measured cause

**Why:** Increasing `windowSize` past defaults trades memory for fill rate; decreasing causes blank flashes. Random tuning regresses both.
**Detection:** `manual-review-only`.
**Sources:**

- [React Native — Optimizing FlatList configuration](https://reactnative.dev/docs/optimizing-flatlist-configuration)

---

## Navigation (Expo Router)

### router/routes-under-app-only: All routes live under `app/`; never import a screen file directly

**Why:** Bypassing the router defeats deep linking, typed routes, and async-route bundle splitting; the screen is reachable only by direct render and breaks the URL contract.
**Detection:** `custom-oxlint-plugin` — forbid relative imports of files under `app/` from outside `app/_layout.tsx` and `app/+not-found.tsx`.
**Sources:**

- [Expo Router — Introduction](https://docs.expo.dev/router/introduction/)
- [Expo Router — Stack](https://docs.expo.dev/router/advanced/stack/)

### router/typed-routes-required: Enable typed routes and never hand-build dynamic hrefs as raw strings

**Why:** String hrefs survive route renames and typos silently; `Href<T>` catches them at compile time. Set `experiments.typedRoutes: true` in `app.config.js`.
**Detection:** `custom-oxlint-plugin` — flag `<Link href="/user/[id]" />` and `router.push(\`/user/\${id}\`)`; require object form `{ pathname, params }` for parameterized routes.
**Sources:**

- [Expo Router — Typed routes](https://docs.expo.dev/router/reference/typed-routes/)

### router/auth-via-stack-protected: Gate auth with `Stack.Protected` (or a `<Redirect>` in the layout), not with conditional `null` returns from screens

**Why:** Returning `null` from a screen still mounts it in the stack history; `Stack.Protected` removes the route entirely so `router.back()` and deep links behave correctly.
**Detection:** `manual-review-only` — semantic check on layout files.
**Sources:**

- [Expo Router — Authentication](https://docs.expo.dev/router/advanced/authentication/)
- [Expo Router — Redirects](https://docs.expo.dev/router/reference/redirects/)

### router/group-routes-for-shared-layouts: Use `(group)` folders for shared layouts; do not nest screens to share UI chrome

**Why:** Manual nesting drags non-routable layout state into screens and breaks URL flatness; group routes keep the URL clean while sharing a layout.
**Detection:** `manual-review-only`.
**Sources:**

- [Expo Router — Introduction](https://docs.expo.dev/router/introduction/)
- [Expo Router — Stack](https://docs.expo.dev/router/advanced/stack/)

### router/modal-via-presentation: Declare modals in the layout with `presentation: 'modal'` (or `'formSheet'`)

**Why:** Stack-presented modals are deep-linkable, animate natively, and respect `router.back()`. Reserve RN's `<Modal>` for transient self-contained dialogs that don't participate in the route tree (alerts, confirmation prompts). For anything routable or deep-linkable, use `expo-router` modal routes. RN `<Modal>` is invisible to the router and on Android suppresses `BackHandler` events.
**Detection:** `custom-oxlint-plugin` — warn when `import { Modal } from 'react-native'` appears in a screen file under `app/` that defines route-level state (e.g., uses `useLocalSearchParams`, `useRouter`, or exports default screen). Acceptable in non-screen component files.
**Sources:**

- [Expo Router — Modals](https://docs.expo.dev/router/advanced/modals/)
- [React Native — BackHandler](https://reactnative.dev/docs/backhandler)

### router/declarative-screen-options: Configure screen options on the `<Stack>`/`<Tabs>` layout via `screenOptions` or `<Stack.Screen options={…}>`, not via `navigation.setOptions` at runtime

**Why:** Imperative `setOptions` runs after first paint, causing a header flash; declarative options are statically known and avoid the flicker.
**Detection:** `custom-oxlint-plugin` — flag `navigation.setOptions(` calls in files under `app/` (allow only in non-screen utilities).
**Sources:**

- [Expo Router — Stack](https://docs.expo.dev/router/advanced/stack/)

### router/redirect-replace-not-push: Use `<Redirect href=…>` for declarative redirects; use `router.replace()` for lifecycle-driven redirects (not `push`)

**Why:** `router.push` adds the redirect source to history — pressing back lands users on the page they were just redirected away from.
**Detection:** `custom-oxlint-plugin` — flag `router.push(` inside `useEffect`/`useFocusEffect` whose body indicates a redirect (heuristic: early-return guard pattern).
**Sources:**

- [Expo Router — Redirects](https://docs.expo.dev/router/reference/redirects/)

### router/back-handler-via-focus-effect: Hardware back: handle via `useFocusEffect` + `BackHandler.addEventListener('hardwareBackPress', …)`, never bare `useEffect`

**Why:** `useEffect`-attached listeners stay live on background screens, swallowing the back press from whatever screen is currently focused.
**Detection:** `custom-oxlint-plugin` — flag `BackHandler.addEventListener` calls inside `useEffect` (require `useFocusEffect` ancestor).
**Sources:**

- [React Native — BackHandler](https://reactnative.dev/docs/backhandler)
- [React Navigation — Custom Android back button handling](https://reactnavigation.org/docs/custom-android-back-button-handling/)

### router/cleanup-back-and-orientation-listeners: Always remove `BackHandler` and orientation listeners on cleanup

**Why:** Leaked subscriptions accumulate across navigations and corrupt back-press handling; common in Fast Refresh scenarios.
**Detection:** `oxlint-builtin: react-hooks/exhaustive-deps` (partial) plus `custom-oxlint-plugin` — require the return value of `BackHandler.addEventListener` to be returned from the effect cleanup.
**Sources:**

- [React Native — BackHandler](https://reactnative.dev/docs/backhandler)

### router/expo-linking-no-manual-parse: Use `expo-linking` and the router's URL scheme; do not parse `Linking.getInitialURL()` by hand

**Why:** Hand-parsed URLs miss query/hash semantics and bypass typed routes, producing inconsistent deep-link behavior between cold-start and warm-start.
**Detection:** `custom-oxlint-plugin` — flag `Linking.getInitialURL` usage when the same function/lexical scope also calls `new URL(...)`, `URL.parse`, or any `String.prototype.match`/regex literal applied to the awaited result. Tightened AST hint: scope = the immediately enclosing `FunctionDeclaration` / `FunctionExpression` / `ArrowFunctionExpression`. Cross-scope flow → out of band (manual review).
**Sources:**

- [Expo Router — Introduction](https://docs.expo.dev/router/introduction/)
- [Expo — expo-linking](https://docs.expo.dev/versions/latest/sdk/linking/)

### router/initial-route-name-on-deep-linked-stacks: Configure `unstable_settings.initialRouteName` on every nested stack reachable via deep link

**Why:** Without it, deep-linking a nested screen has no back stack — the back button immediately exits the app.
**Detection:** `manual-review-only`.
**Sources:**

- [Expo Router — Router settings](https://docs.expo.dev/router/advanced/router-settings/)

### router/screen-tracking-in-root-layout: Track screens via `usePathname()` + `useGlobalSearchParams()` in the root layout, not via per-screen `useEffect`

**Why:** Per-screen effects miss replace-style navigations and double-fire on Fast Refresh; central tracking guarantees every URL change is captured exactly once.
**Detection:** `custom-oxlint-plugin` — flag analytics-track calls inside screen files; allow only inside `app/_layout.tsx`.
**Sources:**

- [Expo Router — Screen tracking](https://docs.expo.dev/router/reference/screen-tracking/)

---

## Layout & safe area

### layout/safe-area-provider-once: Wrap the app root in `<SafeAreaProvider>` exactly once, in `app/_layout.tsx`, inside `GestureHandlerRootView`

**Why:** Multiple providers desync inset values; missing provider makes `useSafeAreaInsets` return zeros, so content slides under the notch / nav bar. Position is fixed by the canonical wrapper order — see [layout/gesture-handler-root-wrap](#layoutgesture-handler-root-wrap).

**Detection:** `custom-oxlint-plugin` — require exactly one `<SafeAreaProvider>` in `app/_layout.tsx`; flag the JSX in any other file.
**Sources:**

- [Expo — Safe areas](https://docs.expo.dev/develop/user-interface/safe-areas/)
- [react-native-safe-area-context](https://github.com/AppAndFlow/react-native-safe-area-context)

### layout/insets-hook-over-safeareaview: Prefer `useSafeAreaInsets()` over `<SafeAreaView>` for screen layouts

**Why:** `<SafeAreaView>` applies padding to the whole subtree, which interferes with FlatList content insets, sticky headers, and edge-to-edge gradients. Hook-based insets let you apply padding only where needed.
**Detection:** `custom-oxlint-plugin` — flag `<SafeAreaView>` JSX in screens under `app/`; allow inside dedicated chrome components.
**Sources:**

- [Expo — Safe areas](https://docs.expo.dev/develop/user-interface/safe-areas/)
- [react-native-safe-area-context](https://github.com/AppAndFlow/react-native-safe-area-context)

### layout/no-rn-safe-area-view: Never import `SafeAreaView` from `react-native`; only from `react-native-safe-area-context`

**Why:** Core `SafeAreaView` is iOS-only and silently no-ops on Android, causing notch / cutout overlap on real devices.
**Detection:** `oxlint-builtin: eslint/no-restricted-imports` — forbid `SafeAreaView` named import from `react-native`.
**Sources:**

- [react-native-safe-area-context](https://github.com/AppAndFlow/react-native-safe-area-context)
- [Expo — Safe areas](https://docs.expo.dev/develop/user-interface/safe-areas/)

### layout/gesture-handler-root-wrap: Canonical root wrapper order in `app/_layout.tsx`

**Why:** Gestures (swipe-to-dismiss, Reanimated gestures, bottom-sheet drag) are not recognized outside `GestureHandlerRootView`; gesture composition only works under a single root. `Reanimated` worklets and `GestureDetector` must be descendants of the same `GestureHandlerRootView`. Cross-root composition silently fails (e.g., pinch+pan stops responding when the modal mounts in a different root).

Canonical wrapper order, outermost first:

```tsx
<GestureHandlerRootView style={{ flex: 1 }}>
  <SafeAreaProvider>
    <ThemeProvider>{/* <Stack /> */}</ThemeProvider>
  </SafeAreaProvider>
</GestureHandlerRootView>
```

This is the single canonical home for the root-wrap order. File 05's `expo/root-wrappers` cross-refs here.

**Detection:** `custom-oxlint-plugin` — AST check on `app/_layout.tsx`. Require `GestureHandlerRootView` to be the outermost JSX in the default export, with `SafeAreaProvider` as a direct child. Also flag `<GestureDetector>` JSX in any file when no `GestureHandlerRootView` ancestor exists in the same file or in `app/_layout.tsx`.
**Sources:**

- [react-native-gesture-handler — Installation](https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation)

### layout/android-modal-needs-own-root: On Android modals, wrap the modal content separately in `GestureHandlerRootView`

**Why:** Android renders `Modal` in a separate window; gestures inside the modal won't fire without their own root view.
**Detection:** `custom-oxlint-plugin` — when `<Modal>` is used (and the layout is Android-targeted), require a `GestureHandlerRootView` child.
**Sources:**

- [react-native-gesture-handler — Installation](https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation)

### layout/keyboard-avoiding-explicit-behavior: Use `<KeyboardAvoidingView>` with explicit per-platform `behavior`

**Why:** A single behavior value misbehaves on the other platform — `'padding'` on Android with adjustResize already enabled causes double-shift; missing behavior leaves iOS inputs hidden. Use `'padding'` on iOS, `'height'` (or omitted with manual handling) on Android.
**Detection:** `custom-oxlint-plugin` — require `behavior` prop on `<KeyboardAvoidingView>`; require it to be `Platform.select(...)` or platform-conditional.
**Sources:**

- [Software Mansion — Keyboard handling in React Native](https://blog.swmansion.com/keyboard-handling-in-react-native-4334b27e44f0)

### layout/keyboard-vertical-offset-with-header: Set `keyboardVerticalOffset` whenever a header sits above the avoiding view

**Why:** Without the offset, the input is pushed up under the header and remains hidden — the most common "keyboard covers input" bug.
**Detection:** `manual-review-only`.
**Sources:**

- [React Native — KeyboardAvoidingView](https://reactnative.dev/docs/keyboardavoidingview)

### images/no-rn-statusbar: Use `expo-status-bar`'s `<StatusBar style="dark"|"light"|"auto" />`, not `react-native`'s `StatusBar`

**Why:** On Android edge-to-edge, several `react-native` StatusBar properties (`backgroundColor`, `translucent`) are deprecated and no-op; `expo-status-bar` warns instead of silently failing. The required prop is `style="dark"|"light"|"auto"` — the `barStyle` prop belongs to the banned API.

This rule is the canonical home for the StatusBar API ban; file 04's `outdoors/explicit-status-bar-style` cross-refs here for the per-screen wording.

**Detection:** `oxlint-builtin: eslint/no-restricted-imports` — forbid `StatusBar` named import from `react-native`.
**Sources:**

- [Expo — expo-status-bar](https://docs.expo.dev/versions/latest/sdk/status-bar/)
- [Expo — System bars](https://docs.expo.dev/develop/user-interface/system-bars/)

### layout/no-android-statusbar-bg-translucent: Edge-to-edge is the default on Android 15+; do not set Android `StatusBar.backgroundColor` or `translucent` props

**Why:** They're no-ops in edge-to-edge and emit runtime warnings; correct approach is to draw the gradient/background yourself and use insets for content.
**Detection:** `custom-oxlint-plugin` — flag `StatusBar` JSX with `backgroundColor` or `translucent` props.
**Sources:**

- [Expo — System bars](https://docs.expo.dev/develop/user-interface/system-bars/)
- [Expo — expo-status-bar](https://docs.expo.dev/versions/latest/sdk/status-bar/)

### layout/expo-navigation-bar-for-android-nav: Use Android's bottom navigation bar customization through `expo-navigation-bar`

**Why:** Direct native edits drift between Expo SDK upgrades; `expo-navigation-bar` is the supported API and respects edge-to-edge constraints.
**Detection:** `manual-review-only`.
**Sources:**

- [Expo — System bars](https://docs.expo.dev/develop/user-interface/system-bars/)

### layout/orientation-via-config-plugin: Lock orientation via `expo-screen-orientation` config plugin in `app.json`, not at runtime, for the default orientation

**Why:** Runtime locks fight the OS during cold start, causing a brief rotation flash; the plugin sets it before the JS bundle loads.
**Detection:** `manual-review-only`.
**Sources:**

- [Expo — expo-screen-orientation](https://docs.expo.dev/versions/latest/sdk/screen-orientation/)

### layout/use-window-dimensions-hook: Read viewport size with `useWindowDimensions()`, never `Dimensions.get('window')` at module top level

**Why:** `Dimensions.get` is a one-shot snapshot — rotating the device, font scaling, or split-screen leaves the value stale and the layout broken until reload.
**Detection:** `custom-oxlint-plugin` — flag `Dimensions.get(` calls outside event handlers / one-shot utilities; require `useWindowDimensions` in components.
**Sources:**

- [React Native — useWindowDimensions](https://reactnative.dev/docs/usewindowdimensions)
- [React Native — Dimensions](https://reactnative.dev/docs/dimensions)

### layout/pressable-not-touchables: Use `<Pressable>` for all touchable surfaces; ban legacy Touchables

**Why:** `Pressable` exposes `pressed` state, `hitSlop`, `pressRetentionOffset`, hover, and `android_ripple` natively; the legacy Touchables miss accessibility and ripple semantics on Android.
**Detection:** `oxlint-builtin: eslint/no-restricted-imports` — forbid `TouchableOpacity`, `TouchableHighlight`, `TouchableWithoutFeedback`, `TouchableNativeFeedback` named imports from `react-native`.
**Sources:**

- [React Native — Pressable](https://reactnative.dev/docs/pressable)

### layout/hit-slop-when-visual-under-48dp: Expand `hitSlop` when a Pressable's visual is under 48 dp

**Why:** When a Pressable visual is under 48 dp, expand the hit area via `hitSlop` (≥ 8 dp) so the logical touch target meets the canonical 48 dp threshold. Visual size and hit area are decoupled — small icons can keep their visual while still being tappable.

References [outdoors/min-touch-target-48dp](04-battery-interruptions-outdoors.md#outdoorsmin-touch-target-48dp) for the canonical threshold rule. The 44 dp iOS HIG floor stays as a hard floor noted in the canonical rule, not redeclared here.

**Detection:** `manual-review-only` (visual size depends on style/runtime).
**Sources:**

- [React Native — Pressable](https://reactnative.dev/docs/pressable)

### layout/gesture-detector-under-ghrv: `GestureDetector` and Reanimated gestures must be descendants of the canonical `GestureHandlerRootView`

> See [layout/gesture-handler-root-wrap](#layoutgesture-handler-root-wrap) for the canonical rule and detection. This entry exists for discoverability under the gestures topic.
