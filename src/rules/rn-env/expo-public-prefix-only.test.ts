import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import rule from './expo-public-prefix-only.ts'

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
})

describe('rn-env/expo-public-prefix-only', () => {
  it('runs', () => {
    tester.run('rn-env/expo-public-prefix-only', rule, {
      valid: [
        {
          filename: '/repo/apps/mobile/src/api.ts',
          code: `const u = process.env.EXPO_PUBLIC_API_URL`,
        },
        {
          filename: '/repo/apps/mobile/src/api.ts',
          code: `const u = process.env['EXPO_PUBLIC_API_URL']`,
        },
        {
          filename: '/repo/apps/mobile/src/api.ts',
          code: `const k = key; const v = process.env[k]`,
        },
        {
          filename: '/repo/apps/api/src/server.ts',
          code: `const u = process.env.DATABASE_URL`,
        },
        {
          filename: '/repo/apps/mobile/plugins/withFoojayFix.js',
          code: `const j = process.env.JAVA_HOME`,
        },
        {
          filename: '/repo/apps/mobile/app.config.js',
          code: `const v = process.env.EAS_PROJECT_ID`,
        },
      ],
      invalid: [
        {
          filename: '/repo/apps/mobile/src/api.ts',
          code: `const u = process.env.API_URL`,
          errors: [{ messageId: 'badPrefix' }],
        },
        {
          filename: '/repo/apps/mobile/src/api.ts',
          code: `const u = process.env['API_URL']`,
          errors: [{ messageId: 'badPrefix' }],
        },
      ],
    })
  })
})
