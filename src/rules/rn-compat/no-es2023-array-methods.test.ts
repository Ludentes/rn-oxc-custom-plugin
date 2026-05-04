import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import rule from './no-es2023-array-methods.ts'

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

describe('rn-compat/no-es2023-array-methods', () => {
  it('runs', () => {
    tester.run('rn-compat/no-es2023-array-methods', rule, {
      valid: [
        {
          filename: '/repo/apps/mobile/app/x.tsx',
          code: `const xs = [...arr].sort((a, b) => a - b)`,
        },
        {
          filename: '/repo/apps/mobile/src/lib/y.ts',
          code: `const xs = [...arr].reverse()`,
        },
        {
          filename: '/repo/apps/api/src/foo.ts',
          code: `const xs = arr.toSorted()`,
        },
        {
          filename: '/repo/apps/mobile/app/x.test.tsx',
          code: `const xs = arr.toSorted()`,
        },
      ],
      invalid: [
        {
          filename: '/repo/apps/mobile/app/x.tsx',
          code: `const xs = arr.toSorted((a, b) => a - b)`,
          errors: [{ messageId: 'banned' }],
        },
        {
          filename: '/repo/apps/mobile/app/x.tsx',
          code: `const xs = [...arr].toSorted()`,
          errors: [{ messageId: 'banned' }],
        },
        {
          filename: '/repo/apps/mobile/src/foo.ts',
          code: `const xs = arr.toReversed()`,
          errors: [{ messageId: 'banned' }],
        },
        {
          filename: '/repo/apps/mobile/src/foo.ts',
          code: `const xs = arr.toSpliced(0, 1)`,
          errors: [{ messageId: 'banned' }],
        },
      ],
    })
  })
})
