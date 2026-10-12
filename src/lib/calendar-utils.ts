import type { CalendarEvent } from '@/components/calendar/calendar'
import type { InferSelectModel } from 'drizzle-orm'
import { usersTable } from '@/db/schema/users'

type User = InferSelectModel<typeof usersTable>

type CalendarDateParts = {
  year: number
  month: number
  day: number
}

function calendarDateParts(value: Date | string): CalendarDateParts | null {
  const rawValue = typeof value === 'string' ? value : value.toISOString()
  const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/)

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch
    return {
      year: Number(year),
      month: Number(month),
      day: Number(day),
    }
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  }
}

function localDateFromParts({ year, month, day }: CalendarDateParts) {
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calculate age from birthdate
 */
export function calculateAge(birthDate: Date): number {
  const today = new Date()
  const birth = calendarDateParts(birthDate)
  if (!birth) return 0

  let age = today.getFullYear() - birth.year
  const monthDiff = today.getMonth() + 1 - birth.month

  // Adjust if birthday hasn't occurred yet this year
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.day)) {
    age--
  }

  return age
}

/**
 * Get birthday date for a specific year
 */
export function getBirthdayForYear(birthDate: Date | string, year: number): Date {
  const birth = calendarDateParts(birthDate)
  if (!birth) return new Date(Number.NaN)
  return localDateFromParts({ ...birth, year })
}

/**
 * Get birthday date for current year
 */
export function getBirthdayThisYear(birthDate: Date): Date {
  const today = new Date()
  return getBirthdayForYear(birthDate, today.getFullYear())
}

/**
 * Format birthday title for calendar display
 */
export function formatBirthdayTitle(fullName: string, age: number): string {
  return `🎂 ${fullName} (${age})`
}

export function getAnniversaryForYear(joinedAt: Date | string, year: number): Date {
  const anniversary = calendarDateParts(joinedAt)
  if (!anniversary) return new Date(Number.NaN)
  return localDateFromParts({ ...anniversary, year })
}

export function formatWorkAnniversaryTitle(fullName: string, years: number): string {
  return `🎉 ${fullName} (${years} ${years === 1 ? 'year' : 'years'})`
}

function nextCalendarDay(date: Date) {
  const next = new Date(date)
  next.setDate(next.getDate() + 1)
  return next
}

/**
 * Transform users with birthdates to calendar events
 * Creates recurring birthday events for multiple years like Google Calendar
 */
export function transformBirthdaysToEvents(users: User[]): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const today = new Date()
  const currentYear = today.getFullYear()

  // Create events for 2 years in the past, current year, and 2 years in the future
  // This ensures birthdays show up when navigating through different months/years
  const yearsToGenerate = [
    currentYear - 2,
    currentYear - 1,
    currentYear,
    currentYear + 1,
    currentYear + 2,
  ]

  for (const user of users) {
    if (user.isActive === false) continue

    // Skip users without birthdate
    if (!user.birthDate) continue

    try {
      const birthDateParts = calendarDateParts(user.birthDate)

      // Skip invalid dates
      if (!birthDateParts) continue
      const birthDate = localDateFromParts(birthDateParts)

      // Create birthday event for each year
      for (const year of yearsToGenerate) {
        const birthdayForYear = getBirthdayForYear(user.birthDate, year)
        const birthdayEnd = nextCalendarDay(birthdayForYear)

        // Calculate age for this specific year
        const ageForYear = year - birthDateParts.year

        const title = formatBirthdayTitle(user.fullName || 'Unknown', ageForYear)

        // Create calendar event with unique ID for each year
        const event: CalendarEvent = {
          id: `${user.id}-${year}`,
          title,
          start: birthdayForYear,
          end: birthdayEnd,
          startDate: formatLocalDate(birthdayForYear),
          endDate: formatLocalDate(birthdayEnd),
          userId: String(user.id),
          birthDate,
          age: ageForYear,
          type: 'birthday',
          allDay: true,
        }

        // Add avatar if available
        // if (user.photo && typeof user.photo === 'object' && 'url' in user.photo && user.photo.url) {
        //   event.avatar = user.photo.url
        // }

        events.push(event)
      }
    } catch (error) {
      console.error(`Error processing birthday for user ${user.id}:`, error)
      // Continue with other users
    }
  }

  return events
}

export function transformWorkAnniversariesToEvents(users: User[]): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const currentYear = new Date().getFullYear()
  const yearsToGenerate = [
    currentYear - 2,
    currentYear - 1,
    currentYear,
    currentYear + 1,
    currentYear + 2,
  ]

  for (const user of users) {
    if (user.isActive === false) continue

    if (!user.joinedAt) continue

    try {
      const joinedAt = calendarDateParts(user.joinedAt)
      if (!joinedAt) continue

      for (const year of yearsToGenerate) {
        const yearsCompleted = year - joinedAt.year
        if (yearsCompleted < 1) continue

        const anniversaryDate = getAnniversaryForYear(user.joinedAt, year)
        const anniversaryEnd = nextCalendarDay(anniversaryDate)
        events.push({
          id: `work-anniversary-${user.id}-${year}`,
          title: formatWorkAnniversaryTitle(user.fullName || 'Unknown', yearsCompleted),
          start: anniversaryDate,
          end: anniversaryEnd,
          startDate: formatLocalDate(anniversaryDate),
          endDate: formatLocalDate(anniversaryEnd),
          userId: String(user.id),
          type: 'anniversary',
          allDay: true,
        })
      }
    } catch (error) {
      console.error(`Error processing work anniversary for user ${user.id}:`, error)
    }
  }

  return events
}

/**
 * Get upcoming birthdays in next N days
 */
export function getUpcomingBirthdays(users: User[], days: number = 30): User[] {
  const today = new Date()
  const futureDate = new Date()
  futureDate.setDate(today.getDate() + days)

  return users
    .filter((user) => {
      if (!user.birthDate) return false

      try {
        const birthdayThisYear = getBirthdayThisYear(new Date(user.birthDate))
        return birthdayThisYear >= today && birthdayThisYear <= futureDate
      } catch {
        return false
      }
    })
    .sort((a, b) => {
      const dateA = getBirthdayThisYear(new Date(a.birthDate!))
      const dateB = getBirthdayThisYear(new Date(b.birthDate!))
      return dateA.getTime() - dateB.getTime()
    })
}

/**
 * Check if today is someone's birthday
 */
export function isBirthdayToday(birthDate: Date): boolean {
  const today = new Date()
  const birth = new Date(birthDate)

  return today.getMonth() === birth.getMonth() && today.getDate() === birth.getDate()
}
