export const FALLBACK_TIME_ZONES = [
  'UTC',
  'Europe/Istanbul',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Dubai',
]

export function getBrowserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export function getTimeZoneOptions(currentTimeZone?: string) {
  const supported =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : FALLBACK_TIME_ZONES

  return Array.from(new Set(['UTC', currentTimeZone, ...supported])).filter(Boolean) as string[]
}

export function formatTimeZoneLabel(timeZone: string) {
  return timeZone.replace(/_/g, ' ')
}
