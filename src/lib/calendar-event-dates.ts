type CalendarDateValue = Date | string

type CalendarDateRangeEvent = {
  start: CalendarDateValue
  end: CalendarDateValue
  allDay?: boolean
  startDate?: string
  endDate?: string
}

function dateOnlyToLocalDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

export function formatDateInTimeZone(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)

    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    if (values.year && values.month && values.day) {
      return `${values.year}-${values.month}-${values.day}`
    }
  } catch {
    // Fall back below when a saved timezone is no longer recognized by Intl.
  }

  return date.toISOString().slice(0, 10)
}

export function normalizeCalendarEventDateRange<T extends CalendarDateRangeEvent>(event: T) {
  const isAllDay = event.allDay ?? true
  const start = isAllDay && event.startDate ? dateOnlyToLocalDate(event.startDate) : null
  const end = isAllDay && event.endDate ? dateOnlyToLocalDate(event.endDate) : null

  return {
    ...event,
    start: start ?? new Date(event.start),
    end: end ?? new Date(event.end),
    allDay: isAllDay,
  }
}

export function getCalendarDisplayEnd(event: { start: Date; end: Date; allDay?: boolean }) {
  if (event.end.getTime() <= event.start.getTime()) {
    return new Date(event.start)
  }

  const end = new Date(event.end)

  if (event.allDay ?? true) {
    // react-big-calendar treats non-midnight all-day ends as spilling into that day.
    if (end.getHours() === 0 && end.getMinutes() === 0) {
      end.setMinutes(end.getMinutes() - 1)
    }
  }

  return end
}
