import type { Rule } from 'eslint'
import { buildGroupStackLayoutPattern, getAppRoots } from '../../util/paths.ts'

// Expo Router lets any layout file export a named `ErrorBoundary` to catch
// render errors thrown anywhere in its subtree. Without it, an uncaught render
// error bubbles to the root, the JS engine prints AndroidRuntime/FATAL, and
// the whole app dies — taking the drawer, sibling stacks, in-flight queries,
// and modal state down with it.
//
// This rule enforces an `ErrorBoundary` named export on:
//   - the root `app/_layout.tsx` (last-resort)
//   - the optional group root `app/({group})/_layout.tsx` (drawer-level)
//   - every per-feature `app/({group})/<feature>/_layout.tsx` (per-stack)
//
// The export can be either an in-place declaration (`export const ErrorBoundary
// = ...`, `export function ErrorBoundary(...)`, `export class ErrorBoundary`),
// or a re-export (`export { Foo as ErrorBoundary }` / `export { ErrorBoundary }
// from '...'`).
//
// Why warn about the root only via this same rule? One rule, one mental model:
// "every layout in the protected set must have ErrorBoundary." Consumers who
// don't use a Drawer route group can leave `group` unset; only the root and
// any feature-stack files matching their app's layout will be checked.

interface Options {
  /**
   * Route-group name (without parentheses) whose internal stacks are
   * protected by this rule. Defaults to `'main'`. Pass `null` to disable
   * group-stack checking and only enforce on the root layout.
   */
  group?: string | null
}

const DEFAULT_GROUP = 'main'

function buildRootLayoutPattern(roots: string[]): RegExp {
  const escaped = roots.map((r) => {
    if (r === '.' || r === '' || r === '/') return ''
    return r.replaceAll(/^\/+|\/+$/g, '').replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/'
  })
  return new RegExp(`(?:^|/)(?:${escaped.join('|')})app/_layout\\.tsx?$`)
}

function buildGroupRootLayoutPattern(roots: string[], group: string): RegExp {
  const escaped = roots.map((r) => {
    if (r === '.' || r === '' || r === '/') return ''
    return r.replaceAll(/^\/+|\/+$/g, '').replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/'
  })
  const g = group.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|/)(?:${escaped.join('|')})app/\\(${g}\\)/_layout\\.tsx?$`)
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Expo Router layout files in the protected set (root, group root, per-feature stacks) must export an ErrorBoundary so a render error in one subtree does not crash the whole app.',
    },
    messages: {
      missingErrorBoundary:
        'This layout file must export ErrorBoundary (e.g. `export { RouteErrorBoundary as ErrorBoundary }`). Without it a render error here propagates to the root and crashes the app. See https://docs.expo.dev/router/error-handling/',
    },
    schema: [
      {
        type: 'object',
        properties: {
          group: { type: ['string', 'null'] },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const filename = (context.filename ?? context.getFilename?.() ?? '').replaceAll('\\', '/')
    const opts = (context.options?.[0] ?? {}) as Options
    const group = opts.group === undefined ? DEFAULT_GROUP : opts.group
    const roots = getAppRoots(context)

    const protectedPatterns: RegExp[] = [buildRootLayoutPattern(roots)]
    if (typeof group === 'string' && group.length > 0) {
      protectedPatterns.push(
        buildGroupRootLayoutPattern(roots, group),
        buildGroupStackLayoutPattern(roots, group),
      )
    }
    const isProtected = protectedPatterns.some((re) => re.test(filename))
    if (!isProtected) return {}

    let hasErrorBoundary = false

    return {
      // export class ErrorBoundary { ... } / export function ErrorBoundary() { ... }
      // / export const ErrorBoundary = ...
      ExportNamedDeclaration(node: any) {
        const decl = node.declaration
        if (decl) {
          if (decl.type === 'FunctionDeclaration' || decl.type === 'ClassDeclaration') {
            if (decl.id?.name === 'ErrorBoundary') hasErrorBoundary = true
          } else if (decl.type === 'VariableDeclaration') {
            for (const d of decl.declarations ?? []) {
              if (d.id?.type === 'Identifier' && d.id.name === 'ErrorBoundary') {
                hasErrorBoundary = true
              }
            }
          }
        }
        // export { Foo as ErrorBoundary } / export { ErrorBoundary } / export { ErrorBoundary } from '...'
        for (const spec of node.specifiers ?? []) {
          const exported = spec.exported
          const name = exported?.name ?? exported?.value
          if (name === 'ErrorBoundary') hasErrorBoundary = true
        }
      },
      'Program:exit'(node: any) {
        if (!hasErrorBoundary) {
          context.report({ node, messageId: 'missingErrorBoundary' })
        }
      },
    }
  },
}

export default rule
