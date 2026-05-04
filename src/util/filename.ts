const ROOT_LAYOUT_PATTERN = /(?:^|\/)app\/_layout\.tsx?$/
const ROUTE_FILE_PATTERN = /\/apps\/mobile\/app\/(?:[^/]+\/)*([^/_][^/]*)\.tsx?$/

export function isRootLayoutFile(filename: string): boolean {
  if (!filename) return false
  return ROOT_LAYOUT_PATTERN.test(filename.replaceAll('\\', '/'))
}

export function isExpoRouterRouteFile(filename: string): boolean {
  if (!filename) return false
  return ROUTE_FILE_PATTERN.test(filename.replaceAll('\\', '/'))
}
