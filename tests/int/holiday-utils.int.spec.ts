import { describe, expect, it } from 'vitest'
import {
  getHolidayCountryOptions,
  getPublicHolidayDateSet,
  getPublicHolidayEvents,
  normalizeHolidayCountryCodes,
} from '@/lib/holiday-utils'

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

describe('holiday utilities', () => {
  it('returns no holidays when no countries are selected', () => {
    expect(getPublicHolidayEvents([], [2026])).toEqual([])
    expect(Array.from(getPublicHolidayDateSet([], [2026]))).toEqual([])
  })

  it('normalizes selected countries against date-holidays supported country codes', () => {
    expect(normalizeHolidayCountryCodes(['tr', 'US', 'invalid', 'TR'])).toEqual(['TR', 'US'])
  })

  it('lists date-holidays country options', () => {
    expect(getHolidayCountryOptions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: 'TR',
        }),
      ]),
    )
  })

  it('generates stable public holiday events for Turkey', () => {
    const events = getPublicHolidayEvents(['TR'], [2026])
    const newYear = events.find((event) => event.id.startsWith('holiday-TR-2026-01-01-'))

    expect(newYear).toEqual(
      expect.objectContaining({
        title: expect.stringContaining('(TR)'),
        type: 'holiday',
      }),
    )
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length)
    expect(getPublicHolidayDateSet(['TR'], [2026]).has('2026-01-01')).toBe(true)
  })

  it('expands multi-day public holidays from date-holidays durations', () => {
    const events = getPublicHolidayEvents(['TR'], [2026])
    const kurban = events.find((event) => event.id.startsWith('holiday-TR-2026-05-27-'))

    expect(kurban).toEqual(
      expect.objectContaining({
        title: expect.stringContaining('Kurban Bayramı'),
        type: 'holiday',
      }),
    )
    expect(formatDate(kurban!.start)).toBe('2026-05-27')
    expect(formatDate(kurban!.end)).toBe('2026-06-01')
    expect(kurban!.startDate).toBe('2026-05-27')
    expect(kurban!.endDate).toBe('2026-06-01')
    expect(Array.from(getPublicHolidayDateSet(['TR'], [2026])).sort()).toEqual(
      expect.arrayContaining([
        '2026-05-27',
        '2026-05-28',
        '2026-05-29',
        '2026-05-30',
        '2026-05-31',
      ]),
    )
  })
})
