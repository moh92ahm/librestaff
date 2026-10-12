/**
 * Unified date formatting utilities for consistent date display across the application
 * All dates are stored as ISO 8601 strings in the database
 */

/**
 * Formats an ISO date string to "Month Day, Year" format
 * Example: "October 15, 2025"
 */
export function formatDate(value?: string | Date | null, locale = 'en-US'): string {
  if (!value) return 'Not specified'

  const date = value instanceof Date ? value : new Date(value)
  if (isNaN(date.getTime())) return 'Not specified'

  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Extracts YYYY-MM-DD from an ISO string for form inputs
 * If the ISO string is already in YYYY-MM-DD format, returns it as-is
 */
export function formatDateForInput(value?: string | Date | null): string {
  if (!value) return ''

  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Extract just the date part (YYYY-MM-DD) from ISO string
  return value.split('T')[0]
}

/**
 * Parses an ISO date string and returns a Date object or undefined
 */
export function parseDate(isoString?: string | null): Date | undefined {
  if (!isoString) return undefined
  const date = new Date(isoString)
  return isNaN(date.getTime()) ? undefined : date
}

/**
 * Checks if an ISO date string is in the past
 */
export function isPastDate(isoString: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const checkDate = new Date(isoString)
  checkDate.setHours(0, 0, 0, 0)
  return checkDate < today
}

/**
 * Checks if an ISO date string is in the future
 */
export function isFutureDate(isoString: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const checkDate = new Date(isoString)
  checkDate.setHours(0, 0, 0, 0)
  return checkDate > today
}
