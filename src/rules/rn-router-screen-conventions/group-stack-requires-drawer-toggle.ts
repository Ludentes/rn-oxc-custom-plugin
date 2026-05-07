import type { Rule } from 'eslint'
import { buildGroupStackLayoutPattern, getAppRoots } from '../../util/paths.ts'

// In an expo-router app where a route group (commonly `(main)`) is wrapped in
// a Drawer, each feature folder under that group has its own Stack `_layout.tsx`
// that owns the screen header. Because the Drawer's own header is hidden in
// this pattern, the *only* way to open the drawer from a feature screen is
// through that stack's header (typically `headerLeft: () => <Hamburger/>`).
//
// Two ways a per-feature layout can break drawer access:
//
//   1. Set `headerShown: false` and forget to render the toggle elsewhere.
//      Result: no header at all, no drawer toggle, screen content butts up
//      against the notch (Stack header normally provides the safe-area inset).
//
//   2. Show the header but never wire `headerLeft`. Result: the title bar
//      renders but there's no way to reach the drawer from inside this stack.
//
// Statically verifying JSX prop content is brittle, so we enforce a simpler
// invariant that catches both: the layout file must reference the configured
// drawer-toggle identifier (default `HamburgerButton`). If you don't mention
// it at all, drawer access is broken — period.

interface Options {
  /**
   * Route-group name (without parentheses) the rule scopes itself to.
   * Defaults to `'main'`, the conventional name for the authenticated/
   * post-onboarding drawer in expo-router apps.
   */
  group?: string
  /**
   * Identifier name expected in per-feature layouts. Defaults to
   * `'HamburgerButton'`. Override if your codebase calls it something else
   * (e.g. `'DrawerToggle'`, `'MenuButton'`).
   */
  identifier?: string
}

const DEFAULT_GROUP = 'main'
const DEFAULT_IDENTIFIER = 'HamburgerButton'

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Per-feature stack layouts inside a Drawer-wrapped route group must reference the drawer-toggle component so the drawer is reachable from the screen header.',
    },
    messages: {
      missingToggle:
        'app/({{group}})/<feature>/_layout.tsx must reference {{identifier}} (e.g. headerLeft: () => <{{identifier}} />). Without it the drawer cannot be opened from this stack.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          group: { type: 'string' },
          identifier: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? ''
    const opts = (context.options?.[0] ?? {}) as Options
    const group = opts.group ?? DEFAULT_GROUP
    const identifier = opts.identifier ?? DEFAULT_IDENTIFIER

    const pattern = buildGroupStackLayoutPattern(getAppRoots(context), group)
    if (!pattern.test(filename.replaceAll('\\', '/'))) return {}

    let referenced = false

    return {
      JSXIdentifier(node: any) {
        if (node.name === identifier) referenced = true
      },
      Identifier(node: any) {
        if (node.name === identifier) referenced = true
      },
      'Program:exit'(node: any) {
        if (!referenced) {
          context.report({
            node,
            messageId: 'missingToggle',
            data: { group, identifier },
          })
        }
      },
    }
  },
}

export default rule
