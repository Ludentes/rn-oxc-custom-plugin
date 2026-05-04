import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import rule from './kv-store-key-prefix.ts'

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
})

const HEAD = `import { setItemAsync, getItemAsync } from 'expo-sqlite/kv-store'`
const NS_HEAD = `import * as kv from 'expo-sqlite/kv-store'`
const DEFAULT_HEAD = `import kv from 'expo-sqlite/kv-store'`
const OPTS = [{ prefix: '^ne:v\\d+:' }]

describe('rn-storage/kv-store-key-prefix', () => {
  it('runs', () => {
    tester.run('rn-storage/kv-store-key-prefix', rule, {
      valid: [
        {
          filename: '/repo/apps/mobile/src/x.ts',
          code: `${HEAD}; setItemAsync('ne:v1:address', 'x')`,
          options: OPTS,
        },
        {
          filename: '/repo/apps/mobile/src/x.ts',
          code: `${NS_HEAD}; kv.setItemAsync('ne:v2:foo', 'x')`,
          options: OPTS,
        },
        {
          filename: '/repo/apps/mobile/src/x.ts',
          code: `${DEFAULT_HEAD}; kv.setItem('ne:v3:foo', 'x')`,
          options: OPTS,
        },
        {
          filename: '/repo/apps/mobile/src/x.ts',
          code: `setItemAsync('whatever', 'x')`,
          options: OPTS,
        },
        {
          filename: '/repo/apps/mobile/src/x.ts',
          code: `${HEAD}; setItemAsync(dynamicKey, 'x')`,
          options: OPTS,
        },
        // No options -> rule is a no-op (so any key passes).
        {
          filename: '/repo/apps/mobile/src/x.ts',
          code: `${HEAD}; setItemAsync('foo', 'x')`,
        },
      ],
      invalid: [
        {
          filename: '/repo/apps/mobile/src/x.ts',
          code: `${HEAD}; setItemAsync('foo', 'x')`,
          options: OPTS,
          errors: [{ messageId: 'badPrefix' }],
        },
        {
          filename: '/repo/apps/mobile/src/x.ts',
          code: `${NS_HEAD}; kv.getItemAsync('settings')`,
          options: OPTS,
          errors: [{ messageId: 'badPrefix' }],
        },
        {
          filename: '/repo/apps/mobile/src/x.ts',
          code: `${DEFAULT_HEAD}; kv.getItem('settings')`,
          options: OPTS,
          errors: [{ messageId: 'badPrefix' }],
        },
      ],
    })
  })
})
