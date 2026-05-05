import type { Rule } from 'eslint'
import { isUserVisibleText } from '../../util/jsx-text.ts'
import { buildAppOrComponentsPattern, getAppRoots } from '../../util/paths.ts'

const TEST_FILE = /\.test\.tsx?$/

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow hard-coded user-visible text in JSX; route through t(...).',
    },
    messages: {
      hardcodedText:
        'User-visible text must go through t(...). Move "{{ text }}" to the translation file.',
    },
    schema: [],
  },
  create(context) {
    const filename = (context.filename ?? '').replaceAll('\\', '/')
    if (!buildAppOrComponentsPattern(getAppRoots(context)).test(filename) || TEST_FILE.test(filename)) {
      return {}
    }
    return {
      JSXText(node: any) {
        if (isUserVisibleText(node.value)) {
          context.report({
            node,
            messageId: 'hardcodedText',
            data: { text: node.value.trim() },
          })
        }
      },
      JSXExpressionContainer(node: any) {
        const expr = node.expression
        if (
          expr?.type === 'Literal' &&
          typeof expr.value === 'string' &&
          isUserVisibleText(expr.value)
        ) {
          context.report({
            node,
            messageId: 'hardcodedText',
            data: { text: expr.value },
          })
        }
      },
    }
  },
}

export default rule
