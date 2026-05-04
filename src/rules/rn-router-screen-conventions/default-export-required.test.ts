import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import rule from './default-export-required.ts'

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

describe('rn-router-screen-conventions/default-export-required', () => {
  it('runs', () => {
    tester.run('rn-router-screen-conventions/default-export-required', rule, {
      valid: [
        {
          filename: '/repo/apps/mobile/app/index.tsx',
          code: `export default function S() { return <View/> }`,
        },
        {
          filename: '/repo/apps/mobile/app/(main)/parties/[id].tsx',
          code: `function S() { return <View/> }; export default S`,
        },
        {
          filename: '/repo/apps/mobile/app/(main)/parties/[id].tsx',
          code: `export { default } from '../elsewhere'`,
        },
        { filename: '/repo/apps/mobile/app/_layout.tsx', code: `export const X = 1` },
        { filename: '/repo/apps/mobile/src/components/Foo.tsx', code: `export const X = 1` },
      ],
      invalid: [
        {
          filename: '/repo/apps/mobile/app/orphan.tsx',
          code: `export const X = 1`,
          errors: [{ messageId: 'missingDefaultExport' }],
        },
      ],
    })
  })
})
