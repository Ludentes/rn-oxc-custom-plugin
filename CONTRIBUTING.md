# Contributing

This package operationalizes the rules in [`docs/`](./docs). The flow:

1. **Catalog first.** Add a topic file under `docs/` if it's a new topic, or extend an existing one. Each rule entry has the schema documented in `docs/00-index.md`.
2. **Author the rule** under `src/rules/<topic>/<slug>.ts` with a sibling `<slug>.test.ts`.
3. **Wire** it into `src/index.ts` so it's exported as `rn-expo/<topic>-<slug>`.
4. **Open a PR** with the new rule + tests + catalog entry.

## Rule shape

ESLint v9-compatible. Rule files export a default `Rule.RuleModule` object:

```ts
import type { Rule } from 'eslint'

const rule: Rule.RuleModule = {
  meta: { type: 'problem', docs: { description: '...' }, messages: { ... }, schema: [] },
  create(context) {
    return { /* visitors */ }
  },
}

export default rule
```

Use only AST features available in the oxlint JS plugin alpha:
- No type-aware rules (no TypeChecker access).
- No cross-file analysis (one file at a time).
- `context.filename` works (verified in v0.0.1).

## Tests

`vitest` + ESLint's `RuleTester`. Each rule needs a `valid` array and an `invalid` array of fixture strings.

Run:

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

## Local dev against your own repo

Point `jsPlugins` at the built file:

```jsonc
{
  "jsPlugins": ["/abs/path/to/rn-oxc-custom-plugin/dist/index.js"]
}
```

`pnpm dev` rebuilds on save.

## Releases

Maintainer-only. `pnpm publish --access public` (the `prepublishOnly` script runs tests + build).
