import type { Rule } from 'eslint'
import { isExpoRouterRouteFile } from '../../util/filename.ts'

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Expo Router route files must export a default component.' },
    messages: { missingDefaultExport: 'Expo Router route files must have a default export.' },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? ''
    if (!isExpoRouterRouteFile(filename)) return {}
    let hasDefault = false
    return {
      ExportDefaultDeclaration() {
        hasDefault = true
      },
      ExportNamedDeclaration(node: any) {
        for (const spec of node.specifiers ?? []) {
          if (spec.exported?.name === 'default' || spec.exported?.value === 'default') {
            hasDefault = true
          }
        }
      },
      'Program:exit'(node: any) {
        if (!hasDefault) {
          context.report({ node, messageId: 'missingDefaultExport' })
        }
      },
    }
  },
}

export default rule
