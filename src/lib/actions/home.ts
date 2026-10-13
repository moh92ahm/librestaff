'use server'

import { and, asc, eq, gte, inArray, isNotNull, lte, or } from 'drizzle-orm'
import { db } from '@/db'
import {
  eventDepartmentTargetsTable,
  eventsTable,
  eventUserTargetsTable,
  leavesTable,
  usersTable,
} from '@/db/schema'
import { getAnnouncementFeed } from '@/lib/announcements'
import { getDepartmentIdsWithAncestors } from '@/lib/department-hierarchy'
import { getScopedUserIds } from '@/lib/permissions'
import { hasFullAccess, type User } from '@/lib/rbac'
import { requireAuth } from '@/lib/auth-guards'

export type HomeAnnouncementPreview = {
  id: string
  title: string
  bodyPreview: string
  creatorName: string
  categoryName: string | null
  categoryColor: string | null
  sentAt: string | null
  createdAt: string
}

export type HomeEventPreview = {
  id: string
  title: string
  type: 'event' | 'birthday'
  startAt: string
  endAt: string
  location: string | null
}

export type HomeAttentionItem =
  | {
      id: string
      type: 'leaveApproval'
      href: string
      personName: string
      submittedAt: string
    }
  | {
      id: string
      type: 'incompleteProfile'
      href: string
      missingFields: Array<'primaryPhone' | 'address' | 'birthDate'>
    }

export type HomePageData = {
  announcements: HomeAnnouncementPreview[]
  announcementCount: number
  upcomingEvents: HomeEventPreview[]
  upcomingEventCount: number
  attentionItems: HomeAttentionItem[]
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getHomeWindow(now = new Date()) {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const mondayIndex = (today.getDay() + 6) % 7
  const endOfNextWeek = new Date(today)
  endOfNextWeek.setDate(today.getDate() + (13 - mondayIndex))
  endOfNextWeek.setHours(23, 59, 59, 999)

  const threeDaysAgo = new Date(now)
  threeDaysAgo.setDate(now.getDate() - 3)

  return {
    now,
    today,
    endOfNextWeek,
    threeDaysAgo,
  }
}

async function getVisibleUpcomingManualEvents(
  user: User,
  startAt: Date,
  endAt: Date,
): Promise<HomeEventPreview[]> {
  const statusCondition = inArray(eventsTable.status, ['new', 'published'])
  const rangeCondition = and(
    gte(eventsTable.startAt, startAt.toISOString()),
    lte(eventsTable.startAt, endAt.toISOString()),
  )

  if (hasFullAccess(user)) {
    const events = await db
      .select()
      .from(eventsTable)
      .where(and(statusCondition, rangeCondition))
      .orderBy(asc(eventsTable.startAt))

    return events.map((event) => ({
      id: event.id,
      title: event.title,
      type: 'event' as const,
      startAt: event.startAt,
      endAt: event.endAt,
      location: event.location,
    }))
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
  const visibilityConditions = [eq(eventsTable.targetType, 'everyone')]
  if (targetedIds.length > 0) {
    visibilityConditions.push(inArray(eventsTable.id, targetedIds))
  }

  const events = await db
    .select()
    .from(eventsTable)
    .where(and(statusCondition, rangeCondition, or(...visibilityConditions)))
    .orderBy(asc(eventsTable.startAt))

  return events.map((event) => ({
    id: event.id,
    title: event.title,
    type: 'event' as const,
    startAt: event.startAt,
    endAt: event.endAt,
    location: event.location,
  }))
}

function birthdayInWindow(birthDateValue: string, startAt: Date, endAt: Date) {
  const birthDate = new Date(birthDateValue)
  if (Number.isNaN(birthDate.getTime())) return null

  const candidates = [startAt.getFullYear(), endAt.getFullYear()].map((year) => {
    const date = new Date(year, birthDate.getMonth(), birthDate.getDate(), 9, 0, 0, 0)
    return date
  })

  return (
    candidates.find(
      (date) => date.getTime() >= startAt.getTime() && date.getTime() <= endAt.getTime(),
    ) || null
  )
}

async function getUpcomingBirthdays(startAt: Date, endAt: Date): Promise<HomeEventPreview[]> {
  const users = await db
    .select({
      id: usersTable.id,
      fullName: usersTable.fullName,
      birthDate: usersTable.birthDate,
    })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.isActive, true),
        eq(usersTable.visibleInTeamDirectory, true),
        isNotNull(usersTable.birthDate),
      ),
    )
    .orderBy(asc(usersTable.fullName))

  return users.flatMap((user) => {
    const birthday = user.birthDate ? birthdayInWindow(user.birthDate, startAt, endAt) : null
    if (!birthday) return []

    return [
      {
        id: `birthday-${user.id}-${birthday.getFullYear()}`,
        title: user.fullName,
        type: 'birthday' as const,
        startAt: birthday.toISOString(),
        endAt: birthday.toISOString(),
        location: null,
      },
    ]
  })
}

async function getAttentionItems(user: User): Promise<HomeAttentionItem[]> {
  const [approvalScope, currentUser] = await Promise.all([
    getScopedUserIds(user, 'leaves', 'approve'),
    db.query.usersTable.findFirst({
      where: eq(usersTable.id, user.id),
      columns: {
        primaryPhone: true,
        address: true,
        birthDate: true,
      },
    }),
  ])

  const pendingApprovals =
    approvalScope !== null && approvalScope.length === 0
      ? []
      : await db
          .select({
            id: leavesTable.id,
            submittedAt: leavesTable.createdAt,
            personName: usersTable.fullName,
          })
          .from(leavesTable)
          .innerJoin(usersTable, eq(leavesTable.userId, usersTable.id))
          .where(
            and(
              eq(leavesTable.status, 'requested'),
              approvalScope ? inArray(leavesTable.userId, approvalScope) : undefined,
            ),
          )
          .orderBy(asc(leavesTable.createdAt))
          .limit(4)

  const attentionItems: HomeAttentionItem[] = pendingApprovals.map((leave) => ({
    id: `leave-approval-${leave.id}`,
    type: 'leaveApproval',
    href: '/leaves',
    personName: leave.personName,
    submittedAt: leave.submittedAt,
  }))

  if (currentUser) {
    const missingFields = (
      [
        ['primaryPhone', currentUser.primaryPhone],
        ['address', currentUser.address],
        ['birthDate', currentUser.birthDate],
      ] as const
    ).flatMap(([field, value]) => (value?.trim() ? [] : [field]))

    if (missingFields.length > 0) {
      attentionItems.push({
        id: 'incomplete-profile',
        type: 'incompleteProfile',
        href: '/me?tab=profile',
        missingFields,
      })
    }
  }

  return attentionItems.slice(0, 5)
}

export async function getHomePageData(): Promise<HomePageData> {
  const user = await requireAuth()
  const { now, today, endOfNextWeek, threeDaysAgo } = getHomeWindow()

  const [feed, manualEvents, birthdays, attentionItems] = await Promise.all([
    getAnnouncementFeed(user),
    getVisibleUpcomingManualEvents(user, today, endOfNextWeek),
    getUpcomingBirthdays(today, endOfNextWeek),
    getAttentionItems(user),
  ])

  const recentAnnouncements = feed
    .filter((item) => {
      const publishedAt = new Date(item.sentAt || item.createdAt)
      return (
        publishedAt.getTime() >= threeDaysAgo.getTime() && publishedAt.getTime() <= now.getTime()
      )
    })
    .sort((a, b) => {
      const aTime = new Date(a.sentAt || a.createdAt).getTime()
      const bTime = new Date(b.sentAt || b.createdAt).getTime()
      return bTime - aTime
    })

  const upcomingEvents = [...manualEvents, ...birthdays]
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 10)

  return {
    announcements: recentAnnouncements.slice(0, 10).map((item) => ({
      id: item.id,
      title: item.title,
      bodyPreview: stripHtml(item.body).slice(0, 180),
      creatorName: item.creatorName,
      categoryName: item.categoryName,
      categoryColor: item.categoryColor,
      sentAt: item.sentAt,
      createdAt: item.createdAt,
    })),
    announcementCount: recentAnnouncements.length,
    upcomingEvents,
    upcomingEventCount: manualEvents.length + birthdays.length,
    attentionItems,
  }
}
