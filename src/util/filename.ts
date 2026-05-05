import { buildExpoRouterRoutePattern } from './paths.ts'

const ROOT_LAYOUT_PATTERN = /(?:^|\/)app\/_layout\.tsx?$/

export function isRootLayoutFile(filename: string): boolean {
  if (!filename) return false
  return ROOT_LAYOUT_PATTERN.test(filename.replaceAll('\\', '/'))
}

export function isExpoRouterRouteFile(
  filename: string,
  appRoots: string[] = ['apps/mobile'],
): boolean {
  if (!filename) return false
  return buildExpoRouterRoutePattern(appRoots).test(filename.replaceAll('\\', '/'))
}
