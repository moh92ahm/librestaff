import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { usersTable } from '@/db/schema'
import { getOrCreateCompanySettings } from '@/lib/company-settings'
import { emitNotificationEvent } from '@/lib/notification-events'
import { WORKFLOW_TRIGGER_TYPES } from '@/lib/workflow-definitions'

const CALENDAR_LOOKAHEAD_DAYS = 7

function datePartsInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const value = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
  }
}

function birthDateParts(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-')
  if (!year || !month || !day) return null
  return { year, month, day }
}

function dateParts(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-')
  if (!year || !month || !day) return null
  return { year, month, day }
}

function dateFromParts(parts: { year: string; month: string; day: string }) {
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)))
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function birthdayDateForYear(birthDate: { month: string; day: string }, year: number) {
  return new Date(Date.UTC(year, Number(birthDate.month) - 1, Number(birthDate.day)))
}

function nextBirthdayFrom(todayDate: Date, birthDate: { month: string; day: string }) {
  let birthday = birthdayDateForYear(birthDate, todayDate.getUTCFullYear())
  if (birthday < todayDate) {
    birthday = birthdayDateForYear(birthDate, todayDate.getUTCFullYear() + 1)
  }
  return birthday
}

function anniversaryDateForYear(joinedAt: { month: string; day: string }, year: number) {
  return new Date(Date.UTC(year, Number(joinedAt.month) - 1, Number(joinedAt.day)))
}

function nextAnniversaryFrom(todayDate: Date, joinedAt: { year: string; month: string; day: string }) {
  const joinedYear = Number(joinedAt.year)
  let anniversary = anniversaryDateForYear(joinedAt, todayDate.getUTCFullYear())
  if (anniversary < todayDate) {
    anniversary = anniversaryDateForYear(joinedAt, todayDate.getUTCFullYear() + 1)
  }
  if (anniversary.getUTCFullYear() <= joinedYear) return null
  return anniversary
}

export async function emitCalendarWorkflowEvents(today = new Date()) {
  const companySettings = await getOrCreateCompanySettings()
  const timezone = companySettings.defaultTimezone || 'UTC'
  const todayParts = datePartsInTimezone(today, timezone)
  const todayDate = dateFromParts(todayParts)
  const maxCalendarDate = addDays(todayDate, CALENDAR_LOOKAHEAD_DAYS)

  const users = await db
    .select({
      id: usersTable.id,
      fullName: usersTable.fullName,
      email: usersTable.email,
      birthDate: usersTable.birthDate,
      joinedAt: usersTable.joinedAt,
    })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.isActive, true),
        eq(usersTable.visibleInTeamDirectory, true),
      ),
    )

  let emitted = 0
  let birthdaysEmitted = 0
  let anniversariesEmitted = 0

  for (const user of users) {
    if (user.birthDate) {
      const birthDate = birthDateParts(user.birthDate)
      if (birthDate) {
        const birthdayDate = nextBirthdayFrom(todayDate, birthDate)
        if (birthdayDate <= maxCalendarDate) {
          const daysUntilBirthday = Math.round((birthdayDate.getTime() - todayDate.getTime()) / 86_400_000)
          const birthdayDateKey = formatDateKey(birthdayDate)

          const eventCreated = await emitNotificationEvent({
            eventType: WORKFLOW_TRIGGER_TYPES.calendarItemUpcoming,
            sourceType: 'calendar_item',
            sourceId: `${user.id}-${birthdayDateKey}`,
            sourceKey: `${WORKFLOW_TRIGGER_TYPES.calendarItemUpcoming}:birthday:${user.id}:${birthdayDateKey}:${daysUntilBirthday}`,
            recipients: [{ id: user.id, email: user.email, fullName: user.fullName }],
            processImmediately: false,
            payload: {
              calendarItemType: 'birthday',
              birthdayUserId: user.id,
              subjectUserId: user.id,
              employeeId: user.id,
              employeeName: user.fullName,
              date: birthdayDateKey,
              daysUntil: String(daysUntilBirthday),
              birthdayDate: birthdayDateKey,
              daysUntilBirthday: String(daysUntilBirthday),
              isBirthdayToday: daysUntilBirthday === 0 ? 'true' : 'false',
              linkUrl: '/calendar',
            },
          })

          if (eventCreated) {
            emitted += 1
            birthdaysEmitted += 1
          }
        }
      }
    }

    if (user.joinedAt) {
      const joinedAt = dateParts(user.joinedAt)
      if (!joinedAt) continue
      const anniversaryDate = nextAnniversaryFrom(todayDate, joinedAt)
      if (!anniversaryDate || anniversaryDate > maxCalendarDate) continue
      const daysUntilAnniversary = Math.round((anniversaryDate.getTime() - todayDate.getTime()) / 86_400_000)
      const anniversaryDateKey = formatDateKey(anniversaryDate)
      const yearsCompleted = anniversaryDate.getUTCFullYear() - Number(joinedAt.year)

      const eventCreated = await emitNotificationEvent({
        eventType: WORKFLOW_TRIGGER_TYPES.calendarItemUpcoming,
        sourceType: 'calendar_item',
        sourceId: `${user.id}-${anniversaryDateKey}`,
        sourceKey: `${WORKFLOW_TRIGGER_TYPES.calendarItemUpcoming}:work_anniversary:${user.id}:${anniversaryDateKey}:${daysUntilAnniversary}`,
        recipients: [{ id: user.id, email: user.email, fullName: user.fullName }],
        processImmediately: false,
        payload: {
          calendarItemType: 'work_anniversary',
          anniversaryUserId: user.id,
          subjectUserId: user.id,
          employeeId: user.id,
          employeeName: user.fullName,
          joinedAt: user.joinedAt.slice(0, 10),
          date: anniversaryDateKey,
          daysUntil: String(daysUntilAnniversary),
          anniversaryDate: anniversaryDateKey,
          daysUntilAnniversary: String(daysUntilAnniversary),
          yearsCompleted: String(yearsCompleted),
          isAnniversaryToday: daysUntilAnniversary === 0 ? 'true' : 'false',
          linkUrl: '/calendar',
        },
      })

      if (eventCreated) {
        emitted += 1
        anniversariesEmitted += 1
      }
    }
  }

  return {
    emitted,
    birthdaysEmitted,
    anniversariesEmitted,
    lookaheadDays: CALENDAR_LOOKAHEAD_DAYS,
  }
}

export const emitBirthdayNotifications = emitCalendarWorkflowEvents
