import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import rule from './group-stack-requires-drawer-toggle.ts'

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

describe('rn-router-screen-conventions/group-stack-requires-drawer-toggle', () => {
  it('runs', () => {
    tester.run('rn-router-screen-conventions/group-stack-requires-drawer-toggle', rule, {
      valid: [
        // Default config, standard pattern — headerLeft wires the hamburger.
        {
          filename: '/repo/apps/mobile/app/(main)/elections/_layout.tsx',
          code: `
            import { Stack } from 'expo-router'
            import { HamburgerButton } from '../../../src/components/HamburgerButton'
            export default function ElectionsStackLayout() {
              return (
                <Stack>
                  <Stack.Screen name="index" options={{
                    title: 'Выборы',
                    headerLeft: () => <HamburgerButton />,
                  }}/>
                </Stack>
              )
            }
          `,
        },
        // Files outside the configured group are not affected.
        {
          filename: '/repo/apps/mobile/app/(intro)/_layout.tsx',
          code: `export default function Layout() { return <Stack/> }`,
        },
        // The group's own root layout is not subject to the rule.
        {
          filename: '/repo/apps/mobile/app/(main)/_layout.tsx',
          code: `export default function Layout() { return <Drawer/> }`,
        },
        // Non-layout files inside a feature are not affected.
        {
          filename: '/repo/apps/mobile/app/(main)/progress/index.tsx',
          code: `export default function Screen() { return <View/> }`,
        },
        // Custom identifier honored via options.
        {
          filename: '/repo/apps/mobile/app/(main)/elections/_layout.tsx',
          code: `
            import { DrawerToggle } from '../../../src/components/DrawerToggle'
            export default function L() {
              return <Stack><Stack.Screen name="index" options={{ headerLeft: () => <DrawerToggle/> }}/></Stack>
            }
          `,
          options: [{ identifier: 'DrawerToggle' }],
        },
        // Custom group name honored via options.
        {
          filename: '/repo/apps/mobile/app/(app)/home/_layout.tsx',
          code: `
            import { HamburgerButton } from 'x'
            export default function L() {
              return <Stack><Stack.Screen name="index" options={{ headerLeft: () => <HamburgerButton/> }}/></Stack>
            }
          `,
          options: [{ group: 'app' }],
        },
        // Flat layout via appRoots="."
        {
          filename: '/repo/app/(main)/home/_layout.tsx',
          code: `
            import { HamburgerButton } from 'x'
            export default function L() {
              return <Stack><Stack.Screen name="index" options={{ headerLeft: () => <HamburgerButton/> }}/></Stack>
            }
          `,
          settings: { 'rn-expo': { appRoots: ['.'] } },
        },
      ],
      invalid: [
        // headerShown: false with no toggle reference.
        {
          filename: '/repo/apps/mobile/app/(main)/progress/_layout.tsx',
          code: `
            import { Stack } from 'expo-router'
            export default function ProgressStackLayout() {
              return (
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" options={{ title: 'Ход голосования' }}/>
                </Stack>
              )
            }
          `,
          errors: [{ messageId: 'missingToggle' }],
        },
        // Header shown but no headerLeft — drawer unreachable.
        {
          filename: '/repo/apps/mobile/app/(main)/news/_layout.tsx',
          code: `
            import { Stack } from 'expo-router'
            export default function NewsStackLayout() {
              return (
                <Stack>
                  <Stack.Screen name="index" options={{ title: 'Новости' }}/>
                </Stack>
              )
            }
          `,
          errors: [{ messageId: 'missingToggle' }],
        },
        // Identifier mismatch: file uses HamburgerButton but rule configured for DrawerToggle.
        {
          filename: '/repo/apps/mobile/app/(main)/news/_layout.tsx',
          code: `
            import { HamburgerButton } from 'x'
            export default function L() {
              return <Stack><Stack.Screen name="index" options={{ headerLeft: () => <HamburgerButton/> }}/></Stack>
            }
          `,
          options: [{ identifier: 'DrawerToggle' }],
          errors: [{ messageId: 'missingToggle' }],
        },
      ],
    })
  })
})
