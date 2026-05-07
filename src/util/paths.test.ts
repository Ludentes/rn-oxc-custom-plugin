import { describe, expect, it } from 'vitest'
import {
  buildAppOrComponentsPattern,
  buildAppOrSrcPattern,
  buildAppPattern,
  buildBuildTimePattern,
  buildExpoRouterRoutePattern,
  buildGroupStackLayoutPattern,
} from './paths.ts'

describe('buildAppPattern', () => {
  it('matches default monorepo layout', () => {
    const re = buildAppPattern(['apps/mobile'])
    expect(re.test('/repo/apps/mobile/src/x.ts')).toBe(true)
    expect(re.test('/repo/apps/web/src/x.ts')).toBe(false)
  })

  it('matches repo root with "."', () => {
    const re = buildAppPattern(['.'])
    expect(re.test('/repo/src/x.ts')).toBe(true)
    expect(re.test('/repo/app/index.tsx')).toBe(true)
  })

  it('matches multiple roots', () => {
    const re = buildAppPattern(['apps/mobile', 'apps/driver'])
    expect(re.test('/repo/apps/mobile/src/x.ts')).toBe(true)
    expect(re.test('/repo/apps/driver/src/x.ts')).toBe(true)
    expect(re.test('/repo/apps/web/src/x.ts')).toBe(false)
  })
})

describe('buildAppOrSrcPattern', () => {
  it('matches app/ and src/ under monorepo root', () => {
    const re = buildAppOrSrcPattern(['apps/mobile'])
    expect(re.test('/repo/apps/mobile/app/x.tsx')).toBe(true)
    expect(re.test('/repo/apps/mobile/src/x.ts')).toBe(true)
    expect(re.test('/repo/apps/mobile/scripts/x.ts')).toBe(false)
  })

  it('matches app/ and src/ at repo root with "."', () => {
    const re = buildAppOrSrcPattern(['.'])
    expect(re.test('/repo/app/x.tsx')).toBe(true)
    expect(re.test('/repo/src/x.ts')).toBe(true)
    expect(re.test('/repo/scripts/x.ts')).toBe(false)
  })
})

describe('buildAppOrComponentsPattern', () => {
  it('matches app/ and src/components/ under monorepo root', () => {
    const re = buildAppOrComponentsPattern(['apps/mobile'])
    expect(re.test('/repo/apps/mobile/app/x.tsx')).toBe(true)
    expect(re.test('/repo/apps/mobile/src/components/Foo.tsx')).toBe(true)
    expect(re.test('/repo/apps/mobile/src/lib/x.ts')).toBe(false)
  })

  it('matches at repo root with "."', () => {
    const re = buildAppOrComponentsPattern(['.'])
    expect(re.test('/repo/app/x.tsx')).toBe(true)
    expect(re.test('/repo/src/components/Foo.tsx')).toBe(true)
    expect(re.test('/repo/src/lib/x.ts')).toBe(false)
  })
})

describe('buildBuildTimePattern', () => {
  it('matches plugins/ and *.config files under monorepo root', () => {
    const re = buildBuildTimePattern(['apps/mobile'])
    expect(re.test('/repo/apps/mobile/plugins/withFoo.js')).toBe(true)
    expect(re.test('/repo/apps/mobile/app.config.ts')).toBe(true)
    expect(re.test('/repo/apps/mobile/metro.config.js')).toBe(true)
    expect(re.test('/repo/apps/mobile/src/api.ts')).toBe(false)
  })

  it('matches at repo root with "."', () => {
    const re = buildBuildTimePattern(['.'])
    expect(re.test('/repo/plugins/withFoo.js')).toBe(true)
    expect(re.test('/repo/metro.config.js')).toBe(true)
    expect(re.test('/repo/src/api.ts')).toBe(false)
  })
})

describe('buildExpoRouterRoutePattern', () => {
  it('matches routes under monorepo root', () => {
    const re = buildExpoRouterRoutePattern(['apps/mobile'])
    expect(re.test('/repo/apps/mobile/app/index.tsx')).toBe(true)
    expect(re.test('/repo/apps/mobile/app/(intro)/about.tsx')).toBe(true)
    expect(re.test('/repo/apps/mobile/app/_layout.tsx')).toBe(false)
  })

  it('matches routes at repo root with "."', () => {
    const re = buildExpoRouterRoutePattern(['.'])
    expect(re.test('/repo/app/index.tsx')).toBe(true)
    expect(re.test('/repo/app/(intro)/about.tsx')).toBe(true)
    expect(re.test('/repo/app/_layout.tsx')).toBe(false)
  })
})

describe('buildGroupStackLayoutPattern', () => {
  it('matches per-feature layouts inside the named group', () => {
    const re = buildGroupStackLayoutPattern(['apps/mobile'], 'main')
    expect(re.test('/repo/apps/mobile/app/(main)/elections/_layout.tsx')).toBe(true)
    expect(re.test('/repo/apps/mobile/app/(main)/progress/_layout.tsx')).toBe(true)
  })

  it('does not match the group root layout itself', () => {
    const re = buildGroupStackLayoutPattern(['apps/mobile'], 'main')
    expect(re.test('/repo/apps/mobile/app/(main)/_layout.tsx')).toBe(false)
  })

  it('does not match nested route groups', () => {
    const re = buildGroupStackLayoutPattern(['apps/mobile'], 'main')
    expect(re.test('/repo/apps/mobile/app/(main)/(tabs)/_layout.tsx')).toBe(false)
  })

  it('does not match feature index files', () => {
    const re = buildGroupStackLayoutPattern(['apps/mobile'], 'main')
    expect(re.test('/repo/apps/mobile/app/(main)/progress/index.tsx')).toBe(false)
  })

  it('honors a custom group name', () => {
    const re = buildGroupStackLayoutPattern(['apps/mobile'], 'app')
    expect(re.test('/repo/apps/mobile/app/(app)/home/_layout.tsx')).toBe(true)
    expect(re.test('/repo/apps/mobile/app/(main)/home/_layout.tsx')).toBe(false)
  })

  it('works with flat repo layout via "."', () => {
    const re = buildGroupStackLayoutPattern(['.'], 'main')
    expect(re.test('/repo/app/(main)/home/_layout.tsx')).toBe(true)
    expect(re.test('/repo/app/(main)/_layout.tsx')).toBe(false)
  })
})
