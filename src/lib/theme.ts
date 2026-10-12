export type AppTheme = 'light' | 'dark'

export const DEFAULT_THEME: AppTheme = 'light'

export function normalizeTheme(value: unknown): AppTheme {
  return value === 'dark' ? 'dark' : DEFAULT_THEME
}
