import type { Rule } from 'eslint'
import { buildAppOrSrcPattern, getAppRoots } from '../../util/paths.ts'

// ES2023 (`Array.prototype.toSorted`, `toReversed`, `toSpliced`, `with`) shipped
// in V8 / JSC / Node before Hermes had matching support. Different RN releases
// pin different Hermes versions, and OEM-customised Hermes builds in some
// Android distributions lag further. A direct call like `arr.toSorted(...)`
// blows up at render time with `TypeError: undefined is not a function` with
// no transpile fallback. Use the spread + classic-method form instead:
//
//   [...arr].sort((a, b) => ...)   // toSorted
//   [...arr].reverse()             // toReversed
//   arr.slice(0, i).concat(...)    // toSpliced — case-by-case
//
// The rule fires on any MemberExpression with a banned property name within
// app source. The rule cannot statically prove the receiver is an Array, but
// these method names are rare enough on other types that the false-positive
// rate stays low.

const TEST_FILE = /\.test\.tsx?$/
const BANNED = new Set(['toSorted', 'toReversed', 'toSpliced'])

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow ES2023 Array.prototype methods (toSorted/toReversed/toSpliced) — Hermes support is uneven across RN versions.',
    },
    messages: {
      banned:
        'Avoid Array.prototype.{{ name }}() — Hermes support is uneven across RN/OEM builds and the call throws "undefined is not a function" at runtime. Use [...arr].{{ alt }}() instead.',
    },
    schema: [],
  },
  create(context) {
    const filename = (context.filename ?? '').replaceAll('\\', '/')
    if (!buildAppOrSrcPattern(getAppRoots(context)).test(filename) || TEST_FILE.test(filename)) {
      return {}
    }
    return {
      MemberExpression(node: any) {
        if (node.computed) return
        const name = node.property?.name
        if (typeof name !== 'string' || !BANNED.has(name)) return
        const alt =
          name === 'toSorted' ? 'sort' : name === 'toReversed' ? 'reverse' : 'splice'
        context.report({
          node: node.property,
          messageId: 'banned',
          data: { name, alt },
        })
      },
    }
  },
}

export default rule
