import gestureHandlerRoot from './rules/rn-required-wrappers/gesture-handler-root.ts'
import noHardcodedJsxText from './rules/rn-i18n/no-hardcoded-jsx-text.ts'
import noHexLiteral from './rules/rn-color-tokens/no-hex-literal-in-component.ts'
import shortIntervalNoAppState from './rules/rn-power/short-interval-without-appstate.ts'
import kvStoreKeyPrefix from './rules/rn-storage/kv-store-key-prefix.ts'
import defaultExportRequired from './rules/rn-router-screen-conventions/default-export-required.ts'
import groupStackRequiresDrawerToggle from './rules/rn-router-screen-conventions/group-stack-requires-drawer-toggle.ts'
import layoutRequiresErrorBoundary from './rules/rn-router-screen-conventions/layout-requires-error-boundary.ts'
import expoPublicPrefixOnly from './rules/rn-env/expo-public-prefix-only.ts'
import flashlistEstimatedItemSize from './rules/rn-imports/flashlist-estimated-item-size.ts'
import noEs2023ArrayMethods from './rules/rn-compat/no-es2023-array-methods.ts'

const plugin = {
  meta: {
    name: 'rn-expo',
    version: '0.2.1',
  },
  rules: {
    'required-wrappers-gesture-handler-root': gestureHandlerRoot,
    'i18n-no-hardcoded-jsx-text': noHardcodedJsxText,
    'color-tokens-no-hex-literal-in-component': noHexLiteral,
    'power-short-interval-without-appstate': shortIntervalNoAppState,
    'storage-kv-store-key-prefix': kvStoreKeyPrefix,
    'router-screen-conventions-default-export-required': defaultExportRequired,
    'router-screen-conventions-group-stack-requires-drawer-toggle': groupStackRequiresDrawerToggle,
    'router-screen-conventions-layout-requires-error-boundary': layoutRequiresErrorBoundary,
    'env-expo-public-prefix-only': expoPublicPrefixOnly,
    'imports-flashlist-estimated-item-size': flashlistEstimatedItemSize,
    'compat-no-es2023-array-methods': noEs2023ArrayMethods,
  },
}

export default plugin
