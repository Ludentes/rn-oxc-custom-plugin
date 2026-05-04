import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import rule from './short-interval-without-appstate.ts'

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
})

describe('rn-power/short-interval-without-appstate', () => {
  it('runs', () => {
    tester.run('rn-power/short-interval-without-appstate', rule, {
      valid: [
        {
          filename: '/repo/apps/mobile/src/sync.ts',
          code: `setInterval(() => {}, 60000)`,
        },
        {
          filename: '/repo/apps/mobile/src/sync.ts',
          code: `import { AppState } from 'react-native'; setInterval(() => { if (AppState.currentState === 'active') {} }, 5000)`,
        },
        {
          filename: '/repo/apps/api/src/cron.ts',
          code: `setInterval(() => {}, 1000)`,
        },
      ],
      invalid: [
        {
          filename: '/repo/apps/mobile/src/sync.ts',
          code: `setInterval(() => {}, 5000)`,
          errors: [{ messageId: 'shortIntervalNoAppState' }],
        },
      ],
    })
  })
})
