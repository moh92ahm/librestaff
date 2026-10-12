import { and, eq, inArray, lte, or } from 'drizzle-orm'
import { db } from '@/db'
import {
  departmentsTable,
  eventDepartmentTargetsTable,
  eventsTable,
  eventUserTargetsTable,
  leavesTable,
  usersTable,
} from '@/db/schema'
import type { CalendarEvent } from '@/components/calendar/calendar'
import { getDepartmentIdsWithAncestors } from '@/lib/department-hierarchy'
import { formatDateInTimeZone } from '@/lib/calendar-event-dates'
import { hasFullAccess, type User } from '@/lib/rbac'

export async function getVisiblePublishedEventCalendarEvents(user: User): Promise<CalendarEvent[]> {
  await markElapsedEventsHeld()

  if (hasFullAccess(user)) {
    const events = await db
      .select()
      .from(eventsTable)
      .where(inArray(eventsTable.status, ['new', 'held', 'cancelled', 'published']))
      .orderBy(eventsTable.startAt)

    return attachTargets(events)
  }

  const [currentUser] = await db
    .select({ departmentId: usersTable.departmentId })
    .from(usersTable)
    .where(eq(usersTable.id, user.id))
    .limit(1)

  const departmentIds = await getDepartmentIdsWithAncestors(currentUser?.departmentId)
  const visibleEventIds = new Set<string>()

  const directTargets = await db
    .select({ eventId: eventUserTargetsTable.eventId })
    .from(eventUserTargetsTable)
    .where(eq(eventUserTargetsTable.userId, user.id))

  directTargets.forEach((target) => visibleEventIds.add(target.eventId))

  if (departmentIds.length > 0) {
    const departmentTargets = await db
      .select({ eventId: eventDepartmentTargetsTable.eventId })
      .from(eventDepartmentTargetsTable)
      .where(inArray(eventDepartmentTargetsTable.departmentId, departmentIds))

    departmentTargets.forEach((target) => visibleEventIds.add(target.eventId))
  }

  const targetedIds = Array.from(visibleEventIds)
  const conditions = [eq(eventsTable.targetType, 'everyone')]
  if (targetedIds.length > 0) {
    conditions.push(inArray(eventsTable.id, targetedIds))
  }

  const events = await db
    .select()
    .from(eventsTable)
    .where(
      and(
        inArray(eventsTable.status, ['new', 'held', 'cancelled', 'published']),
        or(...conditions),
      ),
    )
    .orderBy(eventsTable.startAt)

  return attachTargets(events)
}

export async function getVisibleApprovedLeaveCalendarEvents(user: User): Promise<CalendarEvent[]> {
  const rows = await db
    .select({
      id: leavesTable.id,
      userId: leavesTable.userId,
      type: leavesTable.type,
      startDate: leavesTable.startDate,
      endDate: leavesTable.endDate,
      totalDays: leavesTable.totalDays,
      employeeName: usersTable.fullName,
      departmentManagerUserId: departmentsTable.managerUserId,
    })
    .from(leavesTable)
    .innerJoin(usersTable, eq(leavesTable.userId, usersTable.id))
    .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
    .where(eq(leavesTable.status, 'approved'))
    .orderBy(leavesTable.startDate)

  return rows
    .filter((leave) => {
      if (hasFullAccess(user)) return true
      if (leave.userId === user.id) return true
      return leave.departmentManagerUserId === user.id
    })
    .map((leave) => toLeaveCalendarEvent(leave, user))
}

async function markElapsedEventsHeld() {
  await db
    .update(eventsTable)
    .set({
      status: 'held',
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        inArray(eventsTable.status, ['new', 'published']),
        lte(eventsTable.endAt, new Date().toISOString()),
      ),
    )
}

async function attachTargets(
  events: Array<typeof eventsTable.$inferSelect>,
): Promise<CalendarEvent[]> {
  const eventIds = events.map((event) => event.id)
  if (eventIds.length === 0) return []

  const [departmentTargets, userTargets] = await Promise.all([
    db
      .select({
        eventId: eventDepartmentTargetsTable.eventId,
        departmentId: eventDepartmentTargetsTable.departmentId,
      })
      .from(eventDepartmentTargetsTable)
      .where(inArray(eventDepartmentTargetsTable.eventId, eventIds)),
    db
      .select({
        eventId: eventUserTargetsTable.eventId,
        userId: eventUserTargetsTable.userId,
      })
      .from(eventUserTargetsTable)
      .where(inArray(eventUserTargetsTable.eventId, eventIds)),
  ])

  return events.map((event) =>
    toCalendarEvent(
      event,
      departmentTargets
        .filter((target) => target.eventId === event.id)
        .map((target) => target.departmentId),
      userTargets.filter((target) => target.eventId === event.id).map((target) => target.userId),
    ),
  )
}

function toCalendarEvent(
  event: typeof eventsTable.$inferSelect,
  departmentIds: string[],
  userIds: string[],
): CalendarEvent {
  const start = new Date(event.startAt)
  const end = new Date(event.endAt)
  const normalizedEnd = end.getTime() > start.getTime() ? end : start
  const allDayDates = event.allDay
    ? {
        startDate: formatDateInTimeZone(start, event.timezone),
        endDate: formatDateInTimeZone(normalizedEnd, event.timezone),
      }
    : {}

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    start,
    end: normalizedEnd,
    ...allDayDates,
    type: 'event',
    allDay: event.allDay,
    status: event.status,
    targetType: event.targetType,
    departmentIds,
    userIds,
    timezone: event.timezone,
    location: event.location,
  }
}

function toLeaveCalendarEvent(
  leave: {
    id: string
    userId: string
    type: string
    startDate: string
    endDate: string
    totalDays: number | null
    employeeName: string
  },
  currentUser: User,
): CalendarEvent {
  const start = localDate(leave.startDate)
  const endInclusive = localDate(leave.endDate)
  const displayEnd = addDays(endInclusive, 1)
  const title = `${leave.employeeName} - ${leave.type} leave`

  return {
    id: `leave-${leave.id}`,
    title,
    description:
      leave.totalDays == null
        ? null
        : `${leave.totalDays} ${leave.totalDays === 1 ? 'day' : 'days'}`,
    start,
    end: displayEnd,
    startDate: leave.startDate,
    endDate: formatLocalDate(displayEnd),
    userId: leave.userId,
    type: 'leave',
    allDay: true,
    linkUrl: leave.userId === currentUser.id ? '/me?tab=leaves' : '/leaves',
  }
}

function localDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
