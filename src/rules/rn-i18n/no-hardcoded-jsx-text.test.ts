import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import rule from './no-hardcoded-jsx-text.ts'

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

describe('rn-i18n/no-hardcoded-jsx-text', () => {
  it('runs', () => {
    tester.run('rn-i18n/no-hardcoded-jsx-text', rule, {
      valid: [
        {
          filename: '/repo/apps/mobile/app/index.tsx',
          code: `export default function S() { return <Text>{t('hello')}</Text> }`,
        },
        {
          filename: '/repo/apps/mobile/app/index.tsx',
          code: `export default function S() { return <View><Text>{count}</Text></View> }`,
        },
        {
          filename: '/repo/apps/mobile/app/index.tsx',
          code: `export default function S() { return <Text>•</Text> }`,
        },
        {
          filename: '/repo/apps/mobile/src/components/Foo.test.tsx',
          code: `export default function S() { return <Text>literal allowed in tests</Text> }`,
        },
        {
          filename: '/repo/apps/api/src/routes/foo.tsx',
          code: `export default function S() { return <Text>backend file ignored</Text> }`,
        },
      ],
      invalid: [
        {
          filename: '/repo/apps/mobile/app/index.tsx',
          code: `export default function S() { return <Text>Hello world</Text> }`,
          errors: [{ messageId: 'hardcodedText' }],
        },
        {
          filename: '/repo/apps/mobile/src/components/Foo.tsx',
          code: `export default function S() { return <Text>{"Привет"}</Text> }`,
          errors: [{ messageId: 'hardcodedText' }],
        },
      ],
    })
  })
})
