# State, storage, and offline-first

> See [00-reconciliation.md](00-reconciliation.md) for detection modes, slug conventions, and resolution decisions.

This catalog assumes Zustand + @tanstack/react-query for state. RTK Query is not in scope; if a future migration is considered, raise it as a separate Phase-X memo.

Hard-won lessons from a sibling Expo project are folded in verbatim where applicable.

---

## State management

### state/single-query-client: Use a single dedicated `QueryClient` per app, not per render

**Why:** Re-creating `QueryClient` on render flushes the cache on every re-render, causing infinite refetch loops and breaking persistence. Hydration tries to merge against an empty cache.
**Detection:** `custom-oxlint-plugin` — flag `new QueryClient(` calls inside component bodies (not module-top-level or inside `useState(() => new QueryClient())`).
**Sources:**

- [TanStack Query — Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)
- [TanStack Query — Quick Start](https://tanstack.com/query/latest/docs/framework/react/quick-start)

### state/explicit-stale-time: Set explicit `staleTime` on every query; never rely on the default of 0

**Why:** Default `staleTime: 0` marks data stale immediately, causing a refetch on every mount/focus and burning mobile data. Pick a value per data class (e.g. user profile 5 min, feed 30 s, static lookups `Infinity`).
**Detection:** `custom-oxlint-plugin` — require `staleTime` on `useQuery`/`useInfiniteQuery` options object literal, or set globally via `defaultOptions.queries.staleTime`.
**Sources:**

- [TanStack Query — Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)
- [TanStack Query — Caching Examples](https://tanstack.com/query/latest/docs/framework/react/guides/caching)

### state/gc-time-ge-persister-max-age: Tune `gcTime` ≥ persister `maxAge`; default 5 min is too short for offline apps

**Why:** Default `gcTime` is 5 min. If a query is GC'd before persistence runs, it's never written to disk. For persisted clients, `gcTime` must be ≥ `persistQueryClient.maxAge` or restored data is dropped on hydration.
**Detection:** `manual-review-only` (relationship between two configs).
**Sources:**

- [TanStack Query — persistQueryClient](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient)
- [TanStack Query — Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)

### state/centralized-query-keys: Treat query keys as a stable, hierarchical contract; centralize them

**Why:** Inline query keys (`['user', userId]`) scattered across files cause typos and missed invalidations — `setQueryData(['users', id])` silently no-ops against `['user', id]`. Use a typed key factory module.
**Detection:** `custom-oxlint-plugin` — flag string-literal first elements of `queryKey` arrays not imported from `**/queryKeys.ts`.
**Sources:**

- [TanStack Query — Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys)
- [Effective React Query Keys (TkDodo)](https://tkdodo.eu/blog/effective-react-query-keys)

### state/optimistic-mutation-trio: Always pair `onMutate` with `onError` rollback and `onSettled` invalidation, plus `cancelQueries`

**Why:** Optimistic mutations without `cancelQueries` get clobbered by an in-flight refetch. Without `onError` rollback, a failed mutation leaves the cache lying. Without `onSettled` invalidation, server reality never reconciles.
**Detection:** `custom-oxlint-plugin` — when `useMutation` options literal contains `onMutate`, require `onError` and `onSettled` as sibling keys.
**Sources:**

- [TanStack Query — Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- [Concurrent Optimistic Updates (TkDodo)](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query)

### state/zustand-vs-react-query-vs-context: Choose Zustand for client/UI state; react-query for server state; React Context only for DI

**Why:** Putting server data in Zustand recreates fetch/cache/dedup/retry from scratch. Putting UI state in react-query abuses the cache. Context re-renders every consumer on any change — fine for a `theme` injection, fatal for a frequently-mutating store.

Theme provider, i18n provider, and NavigationContainer/Router are explicit DI examples and are allowed.

**Detection:** `manual-review-only`.
**Sources:**

- [Zustand README — when to use](https://github.com/pmndrs/zustand)
- [TanStack Query — Overview](https://tanstack.com/query/latest/docs/framework/react/overview)

### state/atomic-selectors-use-shallow: Subscribe to Zustand stores with atomic selectors; use `useShallow` for object/array picks

**Why:** `const { a, b } = useStore()` (no selector) re-renders on any state change. Returning a fresh object `(s) => ({ a: s.a, b: s.b })` re-renders every time because reference inequality. `useShallow` does shallow-equal check on the picked keys.
**Detection:** `custom-oxlint-plugin` — flag Zustand store hook calls with no selector argument; flag selectors returning object/array literals not wrapped in `useShallow`.
**Sources:**

- [Zustand — useShallow](https://zustand.docs.pmnd.rs/hooks/use-shallow)
- [Working with Zustand (TkDodo)](https://tkdodo.eu/blog/working-with-zustand)

### state/actions-key-convention: Group actions under a single static `actions` object — never split per-action selectors

**Why:** Actions never change reference (created once at store init). One `useStore((s) => s.actions)` selector is fine — no re-renders. Splitting them just inflates subscription count.
**Detection:** `custom-oxlint-plugin` — flag store factories that don't nest functions under an `actions` key. Convention only — this is a project-wide style choice, not a correctness rule.
**Sources:**

- [Working with Zustand (TkDodo)](https://tkdodo.eu/blog/working-with-zustand)
- [Zustand discussion #1916 — selecting multiple props](https://github.com/pmndrs/zustand/discussions/1916)

### state/no-derived-in-store: Never store derived/computed values in Zustand — derive in selectors

**Why:** Storing `totalCount` derived from `items.length` means two sources of truth. They drift on the first action that forgets to recompute. Compute in the selector or with a memoized hook.
**Detection:** `manual-review-only`.
**Sources:**

- [Zustand — Computed/Derived state](https://zustand.docs.pmnd.rs/guides/maps-and-sets-usage)
- [Working with Zustand (TkDodo)](https://tkdodo.eu/blog/working-with-zustand)

### state/hydration-gate: Gate the UI on persist-rehydration before first render

**Why:** Without a hydration gate, the first paint uses the in-memory default state, then "snaps" to persisted values when storage resolves. Users see logged-out → logged-in flicker; offline queue appears empty for a frame.
**Detection:** `custom-oxlint-plugin` — require `useStore.persist.hasHydrated()` check (or equivalent gate component) at root render boundary when a `persist`-wrapped store exists.
**Sources:**

- [Zustand — persist middleware](https://zustand.docs.pmnd.rs/integrations/persisting-store-data)
- [TanStack Query — persistQueryClient (PersistQueryClientProvider)](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient)

### state/persist-version-migrate-day-1: Always set a `version` and a `migrate` function on `persist`, even at v1

**Why:** Without `version`, a future schema change silently overwrites or crashes hydration. Setting `version: 1` + a no-op `migrate` from v0 makes future migrations a one-line addition.

Related: see [offline/versioned-envelope-day-1](#offlineversioned-envelope-day-1) — the offline-queue envelope is a related but distinct concept (queue payload shape vs persist state shape).

**Detection:** `custom-oxlint-plugin` — require `version` and `migrate` keys on every `persist(...)` options object.
**Sources:**

- [Zustand — persist (versioning & migration)](https://zustand.docs.pmnd.rs/integrations/persisting-store-data)

### state/explicit-retry-policy: Configure `retry` per query class; default of 3 with exponential backoff is wrong for mobile

**Why:** Default retries 3× with 1s/2s/4s backoff. For user-initiated mutations that's a 7-second hang on bad networks. For background queries it can mask permanent 4xx errors. Set `retry: (count, err) => err.status >= 500 && count < 2`.
**Detection:** `custom-oxlint-plugin` — require explicit `retry` on `useMutation` and on `defaultOptions.queries.retry`.
**Sources:**

- [TanStack Query — Query Retries](https://tanstack.com/query/latest/docs/framework/react/guides/query-retries)
- [TanStack Query — Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)

### state/suspense-with-error-boundary: Wrap suspense queries in a `Suspense` + `ErrorBoundary` pair, not just `Suspense`

**Why:** `useSuspenseQuery` throws on error; without an error boundary the whole tree blanks. Provide a recovery boundary at every suspense boundary.
**Detection:** `manual-review-only`.
**Sources:**

- [TanStack Query — Suspense](https://tanstack.com/query/latest/docs/framework/react/guides/suspense)
- [React docs — Suspense](https://react.dev/reference/react/Suspense)

### state/react-query-rn-focus-online: Wire `focusManager` and `onlineManager` to RN AppState + NetInfo

**Why:** TanStack Query's window focus and online detection are web-defaults — they no-op on RN. Without manual wiring, queries don't refetch on app foreground or network restore. Canonical home for this rule; file 01 cross-refs here.
**Detection:** `custom-oxlint-plugin` — require imports of `focusManager`/`onlineManager` somewhere in app entry when `@tanstack/react-query` is used in an Expo project.
**Sources:**

- [TanStack Query — React Native](https://tanstack.com/query/latest/docs/framework/react/react-native)
- [react-native-netinfo README](https://github.com/react-native-netinfo/react-native-netinfo)

---

## Storage

### storage/no-async-storage: `@react-native-async-storage/async-storage` is banned — use `expo-sqlite/kv-store`

**Why:** AsyncStorage on Android has a hard 6 MB SQLite cap (any write past this fails with "database or disk is full") and a ~2 MB CursorWindow read cap. There is no atomicity across multiple keys. `expo-sqlite/kv-store` is a drop-in replacement (same API) backed by full SQLite with sync variants.
**Detection:** `custom-oxlint-plugin` — ban any import `from '@react-native-async-storage/async-storage'`. Auto-fix to `from 'expo-sqlite/kv-store'`.
**Sources:**

- [Expo — SQLite kv-store](https://docs.expo.dev/versions/latest/sdk/sqlite/#kv-store)
- [async-storage issue #83 — Why 6mb dataset size for android?](https://github.com/react-native-async-storage/async-storage/issues/83)

### storage/secure-store-secrets-only: Use `expo-secure-store` ONLY for secrets ≤ ~2 KB (JWTs, refresh tokens, API keys)

**Why:** iOS keychain historically rejects values above ~2048 bytes; Expo doesn't enforce, so large writes throw native errors. Keychain/Keystore round-trips are slow (and may prompt biometrics). Hardware-backed; don't use it as a general KV store.
**Detection:** `custom-oxlint-plugin` — flag `SecureStore.setItemAsync` calls with statically-known string args longer than 1500 chars; flag any value typed as JSON object.
**Sources:**

- [Expo — SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Apple — Keychain Services](https://developer.apple.com/documentation/security/keychain_services)
- [Android — Keystore system](https://developer.android.com/training/articles/keystore)

### storage/decision-matrix: Decision matrix — secrets → SecureStore, KV/state → kv-store, relational/large → SQLite

**Why:** SecureStore = encrypted, hardware-backed, 2 KB, slow. kv-store = fast, atomic per-row, drop-in for AsyncStorage, fine up to a few MB. SQLite = use when you need indexed queries, joins, or > ~5 MB structured data.
**Detection:** `manual-review-only`.
**Sources:**

- [Expo — Store data overview](https://docs.expo.dev/develop/user-interface/store-data/)
- [Expo — SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)

### storage/multi-key-transactions: Wrap multi-key writes in `withExclusiveTransactionAsync`

**Why:** kv-store guarantees per-key atomicity, not multi-key. Two `setItem` calls can interleave with a crash between them, leaving an inconsistent envelope (e.g. queue length increments without entry insert). Use a SQLite transaction for any logically-related write set.
**Detection:** `manual-review-only`.
**Sources:**

- [Expo — SQLite transactions](https://docs.expo.dev/versions/latest/sdk/sqlite/#transactions)
- [SQLite — File Locking And Concurrency](https://sqlite.org/lockingv3.html)

### storage/wal-mode: Enable WAL mode at db open

**Why:** Default rollback-journal mode serializes readers and writers; WAL allows concurrent readers during a write. Without WAL, kv-store under load throws "database is locked" (a known issue).
**Detection:** `custom-oxlint-plugin` — require `PRAGMA journal_mode = WAL` exec on any `openDatabaseAsync` call site, or use `expo-sqlite`'s built-in WAL config.
**Sources:**

- [SQLite — Write-Ahead Logging](https://sqlite.org/wal.html)

### storage/namespace-keys: Namespace keys with a project prefix and a schema version segment

**Why:** Flat keys like `user` or `queue` collide across libraries (kv-store is shared per app). Use a `<app>:<feature>:v<n>` triple — e.g. `ne:tq-cache:v1`, `ne:auth-access:v1`, `ne:sync-snapshot:v1`. The trailing version segment lets you ship a v2 alongside v1 during migration; the feature segment makes greps and migrations targeted.
**Detection:** `custom-oxlint-plugin` — first-arg string Literal must match a configurable regex. Rule is no-op without an options-supplied `prefix`. Configure via `.oxlintrc.json` (example: `"rn-expo/storage-kv-store-key-prefix": ["error", { "prefix": "^myapp:[\\w-]+:v\\d+$" }]`).
**Sources:**

- [Expo — SQLite kv-store](https://docs.expo.dev/versions/latest/sdk/sqlite/#kv-store)

### storage/per-key-size-budget: Per-key size budget — SecureStore ≤ 1.5 KB, kv-store ≤ 256 KB, SQLite for anything bigger

**Why:** SecureStore: see `storage/secure-store-secrets-only`. kv-store stores blobs as SQLite TEXT; large values multiply WAL writes and slow startup hydration. > 256 KB belongs in SQLite tables (indexed, paginated).
**Detection:** `manual-review-only` (runtime guards in storage wrapper).
**Sources:**

- [Expo — SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [SQLite — Limits](https://www.sqlite.org/limits.html)

### storage/encrypt-only-sensitive: Encrypt-at-rest only what's actually sensitive — don't put everything in SecureStore

**Why:** kv-store/SQLite databases are inside the app sandbox (iOS Data Protection class `NSFileProtectionCompleteUntilFirstUserAuthentication` by default; Android internal storage is private per UID). For PII at rest, layer SQLCipher; for secrets, SecureStore. Don't conflate the two.
**Detection:** `manual-review-only`.
**Sources:**

- [Apple — File Protection](https://developer.apple.com/documentation/uikit/protecting_the_user_s_privacy/encrypting_your_app_s_files)
- [Android — Data and file storage](https://developer.android.com/training/data-storage)

### storage/exclude-from-cloud-backup: Exclude SecureStore values and SQLite WAL from iCloud/Google Drive backups when sensitive

**Why:** iOS Keychain items default to backing up to iCloud unless you set `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`. Restoring on a new device leaks tokens. Android Auto Backup includes app data unless excluded.
**Detection:** `manual-review-only`.
**Sources:**

- [Apple — Restoring Your App's Data Securely](https://developer.apple.com/documentation/security/keychain_services/keychain_items/restoring_your_app_s_data_securely)
- [Android — Configure Auto Backup](https://developer.android.com/identity/data/autobackup)

### storage/null-handling: Treat `getItem` returning `null` as "missing"; never write the literal string `"null"`

**Why:** Bug: `Storage.setItem(k, JSON.stringify(maybeUndef))` writes `"null"` or `"undefined"`. On read, `JSON.parse(v)` returns `null`/`undefined` and looks like a cache miss — except `removeItem` was never called, so the row sticks forever.
**Detection:** `manual-review-only` (TS type info required to verify the argument to `JSON.stringify`).
**Sources:**

- [Expo — SQLite kv-store](https://docs.expo.dev/versions/latest/sdk/sqlite/#kv-store)

### storage/no-sync-on-startup: Don't run heavy SQLite work on the JS thread on app start

**Why:** Synchronous `getItemSync` on first paint blocks JS for the duration of SQLite open + read. With WAL recovery this can be 100–500 ms. Use async hydration + a splash gate.
**Detection:** `custom-oxlint-plugin` — flag `Storage.getItemSync`/`setItemSync` calls in module top-level or in components rendered before the splash gate.
**Sources:**

- [Expo — SQLite kv-store sync APIs](https://docs.expo.dev/versions/latest/sdk/sqlite/#kv-store)
- [React Native — Performance](https://reactnative.dev/docs/performance)

### storage/cache-decrypted-secrets: Use SecureStore biometric prompts sparingly; cache decrypted secrets in memory

**Why:** Each biometric-protected `getItemAsync` triggers Face ID / fingerprint UI. Hitting it on every API call is unusable. Decrypt once at unlock, hold the JWT in a non-persisted Zustand slice for the session.
**Detection:** `manual-review-only`.
**Sources:**

- [Expo — SecureStore (authentication options)](https://docs.expo.dev/versions/latest/sdk/securestore/#authentication)

---

## Offline-first

### offline/single-write-path-via-queue: Single offline write-queue slice; both online and offline mutations go through it

**Why:** Two code paths (direct fetch online, queue offline) means two retry/error/optimistic implementations that drift. Routing every write through the queue means crash-recovery, idempotency, and optimistic UI work the same regardless of network state.
**Detection:** `manual-review-only` — verb classification ("is this a write?") needs config and isn't reliably AST-detectable.
**Sources:**

- [TanStack Query — Network Mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode)
- [Adyen — API idempotency](https://docs.adyen.com/development-resources/api-idempotency/)

### offline/persist-and-rehydrate: Persist the queue on every mutation; rehydrate before first render

**Why:** A crash between enqueue and disk write loses the user's submission. Render-before-rehydrate paints an empty list, then snaps. Use `persist` with `onRehydrateStorage` and gate the root tree on `hasHydrated()`.
**Detection:** `custom-oxlint-plugin` — require root `<HydrationGate>` (or equivalent) when offline-queue store is detected.
**Sources:**

- [Zustand — persist & onRehydrateStorage](https://zustand.docs.pmnd.rs/integrations/persisting-store-data)
- [Expo — SQLite kv-store](https://docs.expo.dev/versions/latest/sdk/sqlite/#kv-store)

### offline/queue-entry-shape: Each entry is `{ id (UUIDv4), kind, payload, enqueuedAt, status, attempts, lastError? }`

**Why:** `id` is the idempotency key — server dedupes on retry. `kind` discriminates the worker that handles it. `attempts` drives backoff. Without `enqueuedAt`, ordering after rehydrate is undefined.
**Detection:** `custom-oxlint-plugin` — typecheck `QueueEntry` shape; require zod (or equivalent) parse on rehydration.
**Sources:**

- [Adyen — API idempotency (UUID keys)](https://docs.adyen.com/development-resources/api-idempotency/)
- [AWS — Retry with backoff pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html)

### offline/idempotency-key-required: Send the entry's `id` as `Idempotency-Key` HTTP header on every retry

**Why:** Retried POSTs without an idempotency header create duplicate records when a 200 response is lost in transit. The server must dedupe on `Idempotency-Key`. Detection covers all `POST`/`PUT`/`PATCH`/`DELETE` mutation handlers, not just queue workers. (File 04 cross-refs here.)
**Detection:** `custom-oxlint-plugin` — require `Idempotency-Key` header on any `fetch`/`axios` call whose method is `POST`/`PUT`/`PATCH`/`DELETE`.
**Sources:**

- [Adyen — API idempotency](https://docs.adyen.com/development-resources/api-idempotency/)
- [Stripe — Idempotent Requests](https://docs.stripe.com/api/idempotent_requests)

### offline/versioned-envelope-day-1: Use a versioned envelope from day 1 — `{ version: 1, entries: [...] }` + v0→v1 migration

**Why:** Persisting a bare array `[entry, entry]` makes future schema changes a forced wipe. A versioned envelope plus a no-op v0→v1 migrate establishes the migration plumbing before you need it.
**Detection:** `custom-oxlint-plugin` — flag persist serializers that write/read raw arrays for queue state.
**Sources:**

- [Zustand — persist versioning](https://zustand.docs.pmnd.rs/integrations/persisting-store-data)

### offline/sending-to-pending-on-restart: On app start, reset all `'sending'` entries to `'pending'`

**Why:** Crash recovery: an entry in `'sending'` was mid-flight when the app died. Without reset, the worker skips it (it's already "in progress"). Idempotency-Key makes the retry safe.
**Detection:** `custom-oxlint-plugin` — require a startup hook that runs `entries.filter(e => e.status === 'sending').forEach(set 'pending')` when an offline-queue store is detected.
**Sources:**

- [AWS — Retry with backoff pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html)

### offline/exponential-backoff-jitter: Exponential backoff with jitter; cap attempts and surface dead-letter UI

**Why:** Fixed delays cause thundering herd on network restore. Unbounded retries drain battery and hide permanent failures (4xx). Cap at ~7 attempts; after that, mark `'failed'` and surface to the user.
**Detection:** `custom-oxlint-plugin` — flag retry loops with constant delay or no max-attempts.
**Sources:**

- [AWS — Retry with backoff pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html)
- [Google SRE — Handling Overload (jitter)](https://sre.google/sre-book/handling-overload/)

### offline/classify-retryable-vs-terminal: Distinguish retryable (5xx, network) from terminal (4xx) errors; don't retry 400/422

**Why:** Retrying a 422 (validation) just spams the server with an entry that will never succeed. Move to `'failed'` with `lastError` immediately.
**Detection:** `custom-oxlint-plugin` — require an error classifier in the queue worker; ban blanket `catch { retry() }`.
**Sources:**

- [TanStack Query — Query Retries (retry function)](https://tanstack.com/query/latest/docs/framework/react/guides/query-retries)
- [MDN — HTTP response status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)

### offline/use-internet-reachable: Use NetInfo `isInternetReachable` (not `isConnected`) to gate flushes

**Why:** `isConnected` is true on a captive-portal Wi-Fi with no internet — flushes will all fail. `isInternetReachable` does an actual reachability probe.
**Detection:** `custom-oxlint-plugin` — flag `NetInfo` consumers reading `isConnected` for offline-queue gating; warn that `isInternetReachable` is the correct field.
**Sources:**

- [react-native-netinfo README](https://github.com/react-native-netinfo/react-native-netinfo)
- [NetInfo — API reference](https://github.com/react-native-netinfo/react-native-netinfo/blob/master/docs/API.md)

### offline/event-driven-flush: Drive flush on `onlineManager` / NetInfo subscription, not a polling timer

**Why:** Polling drains battery and lags reconnects by up to the poll interval. Subscribe to `NetInfo.addEventListener` and trigger a flush exactly on the false→true edge of `isInternetReachable`.
**Detection:** `custom-oxlint-plugin` — flag `setInterval`-driven flush loops in the queue module.
**Sources:**

- [react-native-netinfo README](https://github.com/react-native-netinfo/react-native-netinfo)
- [TanStack Query — onlineManager](https://tanstack.com/query/latest/docs/framework/react/reference/onlineManager)

### offline/optimistic-merge-selector: Optimistic merge in a `useXxxMerged` selector; mark pending entries visually

**Why:** Two views of the data (server cache vs pending queue) without a merge means the user submits, sees nothing, and double-submits. The merged selector concatenates the cached list with `entries.filter(status !== 'failed')` and tags pending items so the UI can dim/badge them.
**Detection:** `custom-oxlint-plugin` — flag list components that read from the query cache directly when an offline queue exists for the same `kind` (require the merged selector instead).
**Sources:**

- [TanStack Query — Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- [Concurrent Optimistic Updates (TkDodo)](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query)

### offline/set-query-data-on-success: On success, write the server response into the cache via `setQueryData` before dequeueing

**Why:** If you only invalidate, the UI flickers (optimistic gone → loading → real). Writing the server response into the cache before dequeueing gives a seamless transition.
**Detection:** `manual-review-only`.
**Sources:**

- [TanStack Query — setQueryData](https://tanstack.com/query/latest/docs/framework/react/reference/QueryClient#queryclientsetquerydata)

### offline/tombstones-for-deletes: Tombstones for deletes; never just remove a synced row

**Why:** If a row was created offline (still in queue) and then deleted offline, removing both entries is fine. But if a row was created on-server, deleted offline, and the device hasn't synced yet, the next pull would resurrect it. Mark deleted rows with a `deletedAt` tombstone, sync, then GC.
**Detection:** `manual-review-only`.
**Sources:**

- [Replicache — Sync model](https://doc.replicache.dev/concepts/how-it-works)

### offline/conflict-resolution-per-kind: Define conflict resolution per `kind` explicitly

**Why:** Default behavior on conflict is undefined → silent data loss. Per-`kind` conflict resolution. Default: last-write-wins keyed on `enqueuedAt`. For domains needing stronger conflict resolution (e.g. votes/ballots — server-wins because the server is canonical), document the policy in `docs/playbooks/`. No CRDT lib in scope.
**Detection:** `manual-review-only`.
**Sources:**

- [AWS — Optimistic concurrency control](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBMapper.OptimisticLocking.html)

### offline/persist-mutation-state: Persist mutation state via `persistQueryClient` + `dehydrateOptions.shouldDehydrateMutation`

**Why:** When using react-query's built-in mutation persistence (alternative to a hand-rolled queue), you must opt mutations in. Default `shouldDehydrateMutation` excludes them. Pair with a `mutationDefaults` registration so resumed mutations know their handler.
**Detection:** `manual-review-only`.
**Sources:**

- [TanStack Query — persistQueryClient](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient)
- [TanStack Query — Mutations (paused/resumed)](https://tanstack.com/query/latest/docs/framework/react/guides/mutations#persisting-offline-mutations)
