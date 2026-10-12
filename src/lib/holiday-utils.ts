import Holidays from 'date-holidays'
import type { HolidaysTypes } from 'date-holidays'
import type { CalendarEvent } from '@/components/calendar/calendar'

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000
const DST_TOLERANCE_DAYS = 2 / 24

export type HolidayCountryOption = {
  value: string
  label: string
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values))
}

function toLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return null
  }

  return new Date(year, month - 1, day)
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function extractDate(value: string) {
  const match = value.match(/^\d{4}-\d{2}-\d{2}/)
  return match?.[0] ?? null
}

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function getRuleDurationDays(rule: string) {
  const match = rule.match(/\bP(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?)?\b/)
  if (!match) return null

  const [, days = '0', hours = '0', minutes = '0'] = match
  const durationDays = Number(days) + Number(hours) / 24 + Number(minutes) / (24 * 60)

  return Number.isFinite(durationDays) && durationDays > 0 ? durationDays : null
}

function getHolidayCalendarDayCount(holiday: HolidaysTypes.Holiday) {
  const ruleDurationDays = getRuleDurationDays(holiday.rule)

  if (ruleDurationDays) {
    return Math.max(1, Math.ceil(ruleDurationDays))
  }

  const durationDays = (holiday.end.getTime() - holiday.start.getTime()) / MILLISECONDS_PER_DAY
  if (!Number.isFinite(durationDays) || durationDays <= 0) {
    return 1
  }

  const roundedDays = Math.round(durationDays)
  if (Math.abs(durationDays - roundedDays) <= DST_TOLERANCE_DAYS) {
    return Math.max(1, roundedDays)
  }

  return Math.max(1, Math.ceil(durationDays))
}

function normalizeIdPart(value: string) {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'holiday'
  )
}

function getSupportedCountryMap() {
  const holidays = new Holidays()
  return holidays.getCountries('en')
}

export function getHolidayCountryOptions(): HolidayCountryOption[] {
  const countries = getSupportedCountryMap()

  return Object.entries(countries)
    .map(([code, name]) => ({
      value: code,
      label: `${name} (${code})`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function normalizeHolidayCountryCodes(countryCodes: string[]) {
  const supportedCountries = getSupportedCountryMap()
  const supportedCodes = new Set(Object.keys(supportedCountries))

  return uniqueValues(
    countryCodes
      .map((code) => code.trim().toUpperCase())
      .filter((code) => supportedCodes.has(code)),
  )
}

export function getCalendarHolidayYears(centerDate: Date = new Date()) {
  const year = centerDate.getFullYear()
  return [year - 2, year - 1, year, year + 1, year + 2]
}

export function getPublicHolidayEvents(
  countryCodes: string[],
  years: number[] = getCalendarHolidayYears(),
): CalendarEvent[] {
  const normalizedCountryCodes = normalizeHolidayCountryCodes(countryCodes)

  if (normalizedCountryCodes.length === 0) {
    return []
  }

  const events: CalendarEvent[] = []
  const uniqueYears = uniqueValues(years.map((year) => String(year))).map(Number)

  for (const countryCode of normalizedCountryCodes) {
    const holidays = new Holidays(countryCode, { types: ['public'] })

    for (const year of uniqueYears) {
      for (const holiday of holidays.getHolidays(year)) {
        if (holiday.type !== 'public') continue

        const date = extractDate(holiday.date)
        if (!date) continue

        const start = toLocalDate(date)
        if (!start) continue
        const dayCount = getHolidayCalendarDayCount(holiday)

        events.push({
          id: `holiday-${countryCode}-${date}-${normalizeIdPart(holiday.name)}`,
          title: `${holiday.name} (${countryCode})`,
          start,
          end: addDays(start, dayCount),
          startDate: date,
          endDate: formatLocalDate(addDays(start, dayCount)),
          type: 'holiday',
        })
      }
    }
  }

  return events
}

export function getPublicHolidayDateSet(countryCodes: string[], years: number[]) {
  const holidayDates = new Set<string>()

  for (const event of getPublicHolidayEvents(countryCodes, years)) {
    const current = new Date(event.start)
    const end = new Date(event.end)

    while (current < end) {
      holidayDates.add(formatLocalDate(current))
      current.setDate(current.getDate() + 1)
    }
  }

  return holidayDates
}

export function getPublicHolidayDateSetForRange(
  countryCodes: string[],
  startDate: string,
  endDate: string,
) {
  const startYear = /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? Number(startDate.slice(0, 4)) : NaN
  const endYear = /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? Number(endDate.slice(0, 4)) : NaN

  if (!Number.isFinite(startYear) || !Number.isFinite(endYear) || endYear < startYear) {
    return new Set<string>()
  }

  const years = Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index)
  const holidayDates = getPublicHolidayDateSet(countryCodes, years)

  return new Set(
    Array.from(holidayDates).filter((date) => date >= startDate && date <= endDate),
  )
}
