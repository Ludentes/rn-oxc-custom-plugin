import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import rule from './gesture-handler-root.ts'

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
})

describe('rn-required-wrappers/gesture-handler-root', () => {
  it('runs', () => {
    tester.run('rn-required-wrappers/gesture-handler-root', rule, {
      valid: [
        {
          filename: '/repo/apps/mobile/app/_layout.tsx',
          code: `
            import { GestureHandlerRootView } from 'react-native-gesture-handler'
            export default function Root() {
              return <GestureHandlerRootView><Slot/></GestureHandlerRootView>
            }
          `,
        },
        {
          filename: '/repo/apps/mobile/app/index.tsx',
          code: `export default function Screen() { return <View/> }`,
        },
        {
          filename: '/repo/apps/mobile/app/(intro)/_layout.tsx',
          code: `export default function NestedLayout() { return <Stack/> }`,
        },
      ],
      invalid: [
        {
          filename: '/repo/apps/mobile/app/_layout.tsx',
          code: `
            export default function Root() {
              return <View><Slot/></View>
            }
          `,
          errors: [{ messageId: 'missingGestureHandlerRoot' }],
        },
        {
          filename: '/repo/apps/mobile/app/_layout.ts',
          code: `export default function Root() { return null }`,
          errors: [{ messageId: 'missingGestureHandlerRoot' }],
        },
      ],
    })
  })
})
