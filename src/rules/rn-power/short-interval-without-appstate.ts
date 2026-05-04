import type { Rule } from 'eslint'

const MOBILE_PATH = /\/apps\/mobile\//
const THRESHOLD_MS = 60000

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Forbid setInterval < 60s in files that do not reference AppState.',
    },
    messages: {
      shortIntervalNoAppState:
        'setInterval shorter than 60s without AppState gating wakes the JS thread on Android Doze. Gate the interval on AppState or raise the period.',
    },
    schema: [],
  },
  create(context) {
    const filename = (context.filename ?? '').replaceAll('\\', '/')
    if (!MOBILE_PATH.test(filename)) return {}
    const sourceText = context.sourceCode?.text ?? context.getSourceCode?.().text ?? ''
    const referencesAppState = /\bAppState\b/.test(sourceText)
    if (referencesAppState) return {}
    return {
      CallExpression(node: any) {
        if (node.callee?.type !== 'Identifier' || node.callee.name !== 'setInterval') return
        const arg = node.arguments?.[1]
        if (arg?.type === 'Literal' && typeof arg.value === 'number' && arg.value < THRESHOLD_MS) {
          context.report({ node, messageId: 'shortIntervalNoAppState' })
        }
      },
    }
  },
}

export default rule
