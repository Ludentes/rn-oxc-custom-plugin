import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import rule from './flashlist-estimated-item-size.ts'

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

describe('rn-imports/flashlist-estimated-item-size', () => {
  it('runs', () => {
    tester.run('rn-imports/flashlist-estimated-item-size', rule, {
      valid: [
        { code: `<FlashList data={d} renderItem={r} estimatedItemSize={80}/>` },
        { code: `<FlashList data={d} renderItem={r} {...spread}/>` },
        { code: `<FlatList data={d} renderItem={r}/>` },
        { code: `<View><FlashList data={d} renderItem={r} estimatedItemSize={80}/></View>` },
      ],
      invalid: [
        {
          code: `<FlashList data={d} renderItem={r}/>`,
          errors: [{ messageId: 'missingEstimatedItemSize' }],
        },
        { code: `<FlashList/>`, errors: [{ messageId: 'missingEstimatedItemSize' }] },
      ],
    })
  })
})
