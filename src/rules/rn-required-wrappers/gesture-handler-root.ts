import type { Rule } from 'eslint'
import { isRootLayoutFile } from '../../util/filename.ts'

const REQUIRED_NAME = 'GestureHandlerRootView'

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require <GestureHandlerRootView> in the root Expo Router layout (app/_layout.tsx).',
    },
    messages: {
      missingGestureHandlerRoot:
        'app/_layout.tsx must render <GestureHandlerRootView> at the root for react-native-gesture-handler to work on Android.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? ''
    if (!isRootLayoutFile(filename)) {
      return {}
    }
    let found = false
    return {
      JSXOpeningElement(node: any) {
        if (found) return
        const name = node.name
        if (name?.type === 'JSXIdentifier' && name.name === REQUIRED_NAME) {
          found = true
        }
      },
      'Program:exit'(node: any) {
        if (!found) {
          context.report({ node, messageId: 'missingGestureHandlerRoot' })
        }
      },
    }
  },
}

export default rule
