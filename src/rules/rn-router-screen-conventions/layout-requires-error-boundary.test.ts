import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import rule from './layout-requires-error-boundary.ts'

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

describe('rn-router-screen-conventions/layout-requires-error-boundary', () => {
  it('runs', () => {
    tester.run('rn-router-screen-conventions/layout-requires-error-boundary', rule, {
      valid: [
        // Root layout with re-export form.
        {
          filename: '/repo/apps/mobile/app/_layout.tsx',
          code: `
            import { RouteErrorBoundary } from '../src/components/RouteErrorBoundary'
            export { RouteErrorBoundary as ErrorBoundary }
            export default function Root() { return null }
          `,
        },
        // Root with const export.
        {
          filename: '/repo/apps/mobile/app/_layout.tsx',
          code: `
            export const ErrorBoundary = ({ error, retry }) => null
            export default function Root() { return null }
          `,
        },
        // Root with function declaration export.
        {
          filename: '/repo/apps/mobile/app/_layout.tsx',
          code: `
            export function ErrorBoundary({ error, retry }) { return null }
            export default function Root() { return null }
          `,
        },
        // Group root layout.
        {
          filename: '/repo/apps/mobile/app/(main)/_layout.tsx',
          code: `
            import { Boundary } from 'x'
            export { Boundary as ErrorBoundary }
            export default function Layout() { return null }
          `,
        },
        // Per-feature stack.
        {
          filename: '/repo/apps/mobile/app/(main)/elections/_layout.tsx',
          code: `
            export { RouteErrorBoundary as ErrorBoundary } from '../../../src/components/RouteErrorBoundary'
            export default function L() { return null }
          `,
        },
        // Files outside the protected set are not affected.
        {
          filename: '/repo/apps/mobile/app/(main)/elections/index.tsx',
          code: `export default function Screen() { return null }`,
        },
        {
          filename: '/repo/apps/mobile/src/components/Foo.tsx',
          code: `export const Foo = () => null`,
        },
        // group: null disables group checks; root still must export ErrorBoundary.
        {
          filename: '/repo/apps/mobile/app/(main)/elections/_layout.tsx',
          code: `export default function L() { return null }`,
          options: [{ group: null }],
        },
        // Custom group name.
        {
          filename: '/repo/apps/mobile/app/(app)/home/_layout.tsx',
          code: `
            export { Boundary as ErrorBoundary } from 'x'
            export default function L() { return null }
          `,
          options: [{ group: 'app' }],
        },
        // Flat layout.
        {
          filename: '/repo/app/_layout.tsx',
          code: `
            export const ErrorBoundary = () => null
            export default function Root() { return null }
          `,
          settings: { 'rn-expo': { appRoots: ['.'] } },
        },
      ],
      invalid: [
        // Root layout with no ErrorBoundary export.
        {
          filename: '/repo/apps/mobile/app/_layout.tsx',
          code: `export default function Root() { return null }`,
          errors: [{ messageId: 'missingErrorBoundary' }],
        },
        // Group root.
        {
          filename: '/repo/apps/mobile/app/(main)/_layout.tsx',
          code: `export default function Layout() { return null }`,
          errors: [{ messageId: 'missingErrorBoundary' }],
        },
        // Per-feature stack — the regression we're enshrining.
        {
          filename: '/repo/apps/mobile/app/(main)/progress/_layout.tsx',
          code: `
            import { Stack } from 'expo-router'
            import { HamburgerButton } from 'x'
            export default function ProgressStackLayout() {
              return <Stack><Stack.Screen name="index" options={{ headerLeft: () => <HamburgerButton/> }}/></Stack>
            }
          `,
          errors: [{ messageId: 'missingErrorBoundary' }],
        },
        // Default export named ErrorBoundary doesn't count — must be a *named* export.
        {
          filename: '/repo/apps/mobile/app/_layout.tsx',
          code: `export default function ErrorBoundary() { return null }`,
          errors: [{ messageId: 'missingErrorBoundary' }],
        },
        // Wrong identifier.
        {
          filename: '/repo/apps/mobile/app/_layout.tsx',
          code: `
            export const ErrorBound = () => null
            export default function Root() { return null }
          `,
          errors: [{ messageId: 'missingErrorBoundary' }],
        },
      ],
    })
  })
})
