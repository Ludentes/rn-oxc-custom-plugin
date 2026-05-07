import type { Rule } from 'eslint'

export interface RnExpoSettings {
  /**
   * Path prefixes (relative to repo root, no leading slash) where mobile app
   * source lives. Each rule's filename gate is anchored at one of these roots.
   *
   * Defaults to `['apps/mobile']` to preserve pre-0.1 behavior. For a flat
   * layout where `app/` and `src/` sit at the repo root, set `['.']`.
   *
   * Example for a multi-app repo: `['apps/mobile', 'apps/driver']`.
   */
  appRoots?: string[]
}

const DEFAULT_ROOTS = ['apps/mobile']

export function getAppRoots(context: Rule.RuleContext): string[] {
  const settings = (context.settings as Record<string, unknown> | undefined)?.['rn-expo'] as
    | RnExpoSettings
    | undefined
  const roots = settings?.appRoots
  if (!Array.isArray(roots) || roots.length === 0) return DEFAULT_ROOTS
  return roots
}

function escapeRegex(s: string): string {
  return s.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function rootAlt(roots: string[]): string {
  const parts = roots.map((r) => {
    if (r === '.' || r === '' || r === '/') return ''
    const trimmed = r.replaceAll(/^\/+|\/+$/g, '')
    return escapeRegex(trimmed) + '/'
  })
  return `(?:${parts.join('|')})`
}

export function buildAppPattern(roots: string[]): RegExp {
  return new RegExp(`(?:^|/)${rootAlt(roots)}`)
}

export function buildAppOrSrcPattern(roots: string[]): RegExp {
  return new RegExp(`(?:^|/)${rootAlt(roots)}(?:app|src)/`)
}

export function buildAppOrComponentsPattern(roots: string[]): RegExp {
  return new RegExp(`(?:^|/)${rootAlt(roots)}(?:app|src/components)/`)
}

export function buildBuildTimePattern(roots: string[]): RegExp {
  return new RegExp(`(?:^|/)${rootAlt(roots)}(?:plugins/|[^/]*\\.config\\.(?:m?[jt]s)$)`)
}

export function buildExpoRouterRoutePattern(roots: string[]): RegExp {
  return new RegExp(
    `(?:^|/)${rootAlt(roots)}app/(?:[^/]+/)*([^/_][^/]*)\\.tsx?$`,
  )
}

/**
 * Matches per-feature stack layouts under a named Expo Router group, e.g.
 * `app/(main)/elections/_layout.tsx`. Excludes the group's own root layout
 * (`app/(main)/_layout.tsx`) and nested groups (`app/(main)/(tabs)/_layout.tsx`).
 *
 * `group` is the route-group name **without** parentheses — pass `'main'`,
 * not `'(main)'`. Defaults to `'main'`, the conventional name for the
 * authenticated/post-onboarding drawer in expo-router apps.
 */
export function buildGroupStackLayoutPattern(roots: string[], group: string): RegExp {
  const g = escapeRegex(group)
  return new RegExp(
    `(?:^|/)${rootAlt(roots)}app/\\(${g}\\)/(?!\\()[^/]+/_layout\\.tsx?$`,
  )
}
