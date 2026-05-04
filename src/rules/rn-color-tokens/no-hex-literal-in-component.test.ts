import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import rule from './no-hex-literal-in-component.ts'

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

describe('rn-color-tokens/no-hex-literal-in-component', () => {
  it('runs', () => {
    tester.run('rn-color-tokens/no-hex-literal-in-component', rule, {
      valid: [
        {
          filename: '/repo/apps/mobile/app/x.tsx',
          code: `import { COLORS } from './theme'; export default function S() { return <View style={{ color: COLORS.fg }}/> }`,
        },
        {
          filename: '/repo/apps/mobile/src/lib/colors.ts',
          code: `export const COLORS = { fg: '#000000' }`,
        },
        {
          filename: '/repo/apps/api/src/routes/foo.tsx',
          code: `export default function S() { return <View style={{ color: '#fff' }}/> }`,
        },
      ],
      invalid: [
        {
          filename: '/repo/apps/mobile/app/x.tsx',
          code: `export default function S() { return <View style={{ color: '#ff00aa' }}/> }`,
          errors: [{ messageId: 'hexLiteral' }],
        },
        {
          filename: '/repo/apps/mobile/src/components/Foo.tsx',
          code: `const C = '#fff'; export default function S() { return <Text style={{ color: C }}>x</Text> }`,
          errors: [{ messageId: 'hexLiteral' }],
        },
      ],
    })
  })
})
