import { describe, expect, it } from 'vitest'
import { normalizeEnabledLanguages, normalizeLocale } from '@/i18n/config'
import { normalizeTheme } from '@/lib/theme'

describe('user preference utilities', () => {
  it('keeps English enabled and filters unsupported languages', () => {
    expect(normalizeEnabledLanguages(['tr', 'invalid', 'en', 'tr'])).toEqual(['en', 'tr'])
    expect(normalizeEnabledLanguages([])).toEqual(['en'])
  })

  it('falls back to English when the locale is unsupported or disabled', () => {
    expect(normalizeLocale('tr', ['en', 'tr'])).toBe('tr')
    expect(normalizeLocale('tr', ['en'])).toBe('en')
    expect(normalizeLocale('de', ['en', 'tr'])).toBe('en')
  })

  it('supports only light and dark themes', () => {
    expect(normalizeTheme('dark')).toBe('dark')
    expect(normalizeTheme('light')).toBe('light')
    expect(normalizeTheme('system')).toBe('light')
  })
})
