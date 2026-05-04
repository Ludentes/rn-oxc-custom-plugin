export function isUserVisibleText(raw: string): boolean {
  if (!raw) return false
  const trimmed = raw.trim()
  if (!trimmed) return false
  return /[A-Za-zА-Яа-яЁё]/.test(trimmed)
}
