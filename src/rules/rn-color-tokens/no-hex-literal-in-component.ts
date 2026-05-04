import type { Rule } from 'eslint'

const COMPONENT_PATH = /\/apps\/mobile\/(app|src\/components)\//
const ALLOWED_FILE = /\/(theme|colors|tokens)\.tsx?$/
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow hex color literals in component files; use theme tokens.',
    },
    messages: {
      hexLiteral: 'Hex color "{{value}}" must come from the theme module, not a literal.',
    },
    schema: [],
  },
  create(context) {
    const filename = (context.filename ?? '').replaceAll('\\', '/')
    if (!COMPONENT_PATH.test(filename) || ALLOWED_FILE.test(filename)) return {}
    return {
      Literal(node: any) {
        if (typeof node.value === 'string' && HEX.test(node.value)) {
          context.report({ node, messageId: 'hexLiteral', data: { value: node.value } })
        }
      },
    }
  },
}

export default rule
