import type { Rule } from 'eslint'
import { buildAppPattern, buildBuildTimePattern, getAppRoots } from '../../util/paths.ts'

// Files that run at build time, not in the JS bundle: Expo config plugins,
// app.config.{js,ts}, and any *.config.{js,ts}.
const PUBLIC_PREFIX = /^EXPO_PUBLIC_/

function readKey(node: any): string | null {
  if (
    node.type === 'MemberExpression' &&
    node.object?.type === 'MemberExpression' &&
    node.object.object?.type === 'Identifier' &&
    node.object.object.name === 'process' &&
    node.object.property?.type === 'Identifier' &&
    node.object.property.name === 'env'
  ) {
    if (!node.computed && node.property?.type === 'Identifier') return node.property.name
    if (
      node.computed &&
      node.property?.type === 'Literal' &&
      typeof node.property.value === 'string'
    ) {
      return node.property.value
    }
  }
  return null
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Only EXPO_PUBLIC_* env vars are available in the Expo JS bundle.' },
    messages: {
      badPrefix:
        'process.env.{{name}} is undefined in the Expo JS bundle. Only EXPO_PUBLIC_* env vars survive.',
    },
    schema: [],
  },
  create(context) {
    const filename = (context.filename ?? '').replaceAll('\\', '/')
    const roots = getAppRoots(context)
    if (!buildAppPattern(roots).test(filename) || buildBuildTimePattern(roots).test(filename)) {
      return {}
    }
    return {
      MemberExpression(node: any) {
        const name = readKey(node)
        if (name && !PUBLIC_PREFIX.test(name)) {
          context.report({ node, messageId: 'badPrefix', data: { name } })
        }
      },
    }
  },
}

export default rule
