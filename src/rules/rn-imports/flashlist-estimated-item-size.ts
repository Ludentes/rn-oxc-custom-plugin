import type { Rule } from 'eslint'

const COMPONENT = 'FlashList'
const REQUIRED_ATTR = 'estimatedItemSize'

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require estimatedItemSize on <FlashList>.',
    },
    messages: {
      missingEstimatedItemSize: '<FlashList> requires estimatedItemSize for windowing.',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node: any) {
        const name = node.name
        if (name?.type !== 'JSXIdentifier' || name.name !== COMPONENT) return
        let hasAttr = false
        let hasSpread = false
        for (const attr of node.attributes ?? []) {
          if (attr.type === 'JSXSpreadAttribute') {
            hasSpread = true
            continue
          }
          if (attr.type === 'JSXAttribute' && attr.name?.name === REQUIRED_ATTR) {
            hasAttr = true
          }
        }
        if (!hasAttr && !hasSpread) {
          context.report({ node, messageId: 'missingEstimatedItemSize' })
        }
      },
    }
  },
}

export default rule
