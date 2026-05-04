import { describe, expect, it } from 'vitest'
import { isExpoRouterRouteFile, isRootLayoutFile } from './filename.ts'

describe('isRootLayoutFile', () => {
  it('matches the canonical Expo Router root layout', () => {
    expect(isRootLayoutFile('/repo/apps/mobile/app/_layout.tsx')).toBe(true)
  })

  it('matches the .ts variant', () => {
    expect(isRootLayoutFile('/repo/apps/mobile/app/_layout.ts')).toBe(true)
  })

  it('does not match nested layouts', () => {
    expect(isRootLayoutFile('/repo/apps/mobile/app/(intro)/_layout.tsx')).toBe(false)
  })

  it('does not match regular screen files', () => {
    expect(isRootLayoutFile('/repo/apps/mobile/app/index.tsx')).toBe(false)
  })

  it('does not match an unrelated _layout.tsx outside of an app/ dir', () => {
    expect(isRootLayoutFile('/repo/some/random/_layout.tsx')).toBe(false)
  })
})

describe('isExpoRouterRouteFile', () => {
  it('matches a basic route', () => {
    expect(isExpoRouterRouteFile('/repo/apps/mobile/app/index.tsx')).toBe(true)
  })
  it('matches a nested route under a group', () => {
    expect(isExpoRouterRouteFile('/repo/apps/mobile/app/(intro)/about.tsx')).toBe(true)
  })
  it('matches a dynamic route', () => {
    expect(isExpoRouterRouteFile('/repo/apps/mobile/app/(main)/parties/[id].tsx')).toBe(true)
  })
  it('does not match _layout files', () => {
    expect(isExpoRouterRouteFile('/repo/apps/mobile/app/_layout.tsx')).toBe(false)
    expect(isExpoRouterRouteFile('/repo/apps/mobile/app/(intro)/_layout.tsx')).toBe(false)
  })
  it('does not match files outside app/', () => {
    expect(isExpoRouterRouteFile('/repo/apps/mobile/src/components/Foo.tsx')).toBe(false)
  })
})
