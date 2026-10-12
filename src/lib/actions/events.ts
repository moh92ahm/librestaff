'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import {
  eventDepartmentTargetsTable,
  eventsTable,
  eventUserTargetsTable,
  notificationEmailDeliveriesTable,
  notificationsTable,
} from '@/db/schema'
import { requireFullAccess } from '@/lib/auth-guards'
import {
  assertTargetSelection,
  normalizeTargetType,
  resolveCommunicationRecipients,
  uniqueIds,
  type CommunicationTargetType,
} from '@/lib/communication-recipients'
import { getOrCreateCompanySettings } from '@/lib/company-settings'
import {
  emitNotificationEvent,
  NOTIFICATION_EVENTS,
  toNotificationRecipients,
} from '@/lib/notification-events'

function clean(value: FormDataEntryValue | null) {
  return String(value || '').trim()
}

function formIds(formData: FormData, key: string) {
  return uniqueIds(formData.getAll(key).map((value) => String(value)))
}

function normalizeDateTime(value: string) {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
}

function getEventValues(formData: FormData) {
  const eventStatus = clean(formData.get('eventStatus'))

  return {
    id: clean(formData.get('id')) || null,
    status: eventStatus === 'cancelled' ? ('cancelled' as const) : ('new' as const),
    title: clean(formData.get('title')),
    description: clean(formData.get('description')) || null,
    targetType: normalizeTargetType(clean(formData.get('targetType'))),
    departmentIds: formIds(formData, 'departmentIds'),
    userIds: formIds(formData, 'userIds'),
    startAt: normalizeDateTime(clean(formData.get('startAt'))),
    endAt: normalizeDateTime(clean(formData.get('endAt'))),
    allDay: formData.get('allDay') === 'on',
    timezone: clean(formData.get('timezone')),
    location: clean(formData.get('location')) || null,
  }
}

function validateEvent(values: ReturnType<typeof getEventValues>) {
  if (!values.title) throw new Error('Title is required.')
  if (!values.startAt) throw new Error('Start date and time are required.')
  if (!values.endAt) throw new Error('End date and time are required.')
  assertTargetSelection(values)
  if (new Date(values.endAt).getTime() <= new Date(values.startAt).getTime()) {
    throw new Error('End date and time must be after the start.')
  }
}

async function replaceEventTargets(
  eventId: string,
  targetType: CommunicationTargetType,
  departmentIds: string[],
  userIds: string[],
) {
  await db.transaction(async (tx) => {
    await tx
      .delete(eventDepartmentTargetsTable)
      .where(eq(eventDepartmentTargetsTable.eventId, eventId))
    await tx.delete(eventUserTargetsTable).where(eq(eventUserTargetsTable.eventId, eventId))

    if (targetType === 'departments' && departmentIds.length > 0) {
      await tx.insert(eventDepartmentTargetsTable).values(
        departmentIds.map((departmentId) => ({
          eventId,
          departmentId,
        })),
      )
    }

    if (targetType === 'users' && userIds.length > 0) {
      await tx.insert(eventUserTargetsTable).values(
        userIds.map((userId) => ({
          eventId,
          userId,
        })),
      )
    }
  })
}

export async function createCalendarEventAction(formData: FormData) {
  await saveEventFromForm(formData)
}

export async function deleteCalendarEventAction(formData: FormData) {
  await requireFullAccess()

  const id = clean(formData.get('id'))
  if (!id) throw new Error('Event ID is required.')

  await db.transaction(async (tx) => {
    const notificationRows = await tx
      .select({ id: notificationsTable.id })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.sourceType, 'event'), eq(notificationsTable.sourceId, id)))

    const notificationIds = notificationRows.map((notification) => notification.id)

    if (notificationIds.length > 0) {
      await tx
        .delete(notificationEmailDeliveriesTable)
        .where(inArray(notificationEmailDeliveriesTable.notificationId, notificationIds))
      await tx.delete(notificationsTable).where(inArray(notificationsTable.id, notificationIds))
    }

    await tx.delete(eventDepartmentTargetsTable).where(eq(eventDepartmentTargetsTable.eventId, id))
    await tx.delete(eventUserTargetsTable).where(eq(eventUserTargetsTable.eventId, id))
    await tx.delete(eventsTable).where(eq(eventsTable.id, id))
  })

  revalidatePath('/calendar')
  revalidatePath('/calendar')
  redirect('/calendar')
}

async function saveEventFromForm(formData: FormData) {
  const user = await requireFullAccess()
  const values = getEventValues(formData)
  validateEvent(values)
  const companySettings = await getOrCreateCompanySettings()

  let eventId = values.id
  let existingPublishedAt: string | null = null

  if (eventId) {
    const [existingEvent] = await db
      .select({
        id: eventsTable.id,
        status: eventsTable.status,
        publishedAt: eventsTable.publishedAt,
      })
      .from(eventsTable)
      .where(eq(eventsTable.id, eventId))
      .limit(1)

    if (!existingEvent) throw new Error('Event not found.')
    existingPublishedAt = existingEvent.publishedAt

    if (existingEvent.status !== 'new' && existingEvent.status !== 'published') {
      throw new Error('Only new events can be edited.')
    }

    await db
      .update(eventsTable)
      .set({
        status: values.status,
        title: values.title,
        description: values.description,
        targetType: values.targetType,
        startAt: values.startAt,
        endAt: values.endAt,
        allDay: values.allDay,
        timezone: values.timezone || companySettings.defaultTimezone,
        location: values.location,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(eventsTable.id, eventId))
  } else {
    const [created] = await db
      .insert(eventsTable)
      .values({
        title: values.title,
        description: values.description,
        status: values.status,
        targetType: values.targetType,
        startAt: values.startAt,
        endAt: values.endAt,
        allDay: values.allDay,
        timezone: values.timezone || companySettings.defaultTimezone,
        location: values.location,
        createdById: user.id,
      })
      .returning()

    eventId = created.id
  }

  await replaceEventTargets(eventId, values.targetType, values.departmentIds, values.userIds)
  if (values.status === 'cancelled') {
    await emitEventNotification(eventId, NOTIFICATION_EVENTS.calendarEventCancelled, user.id, true)
  } else if (existingPublishedAt) {
    await emitEventNotification(eventId, NOTIFICATION_EVENTS.calendarEventUpdated, user.id, true)
  } else if (values.status === 'new') {
    await publishEventById(eventId)
  }

  revalidatePath('/calendar')
  redirect('/calendar')
}

export async function publishEventById(id: string) {
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1)

  if (!event) throw new Error('Event not found.')
  if (event.status !== 'new' && event.status !== 'published') return event
  if (event.publishedAt) return event

  await emitEventNotification(event.id, NOTIFICATION_EVENTS.calendarEventCreated, event.createdById)

  const [updated] = await db
    .update(eventsTable)
    .set({
      status: 'new',
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(eventsTable.id, id))
    .returning()

  return updated
}

async function emitEventNotification(
  id: string,
  eventType: string,
  actorUserId?: string | null,
  unique = false,
) {
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1)
  if (!event) return

  const [departmentTargets, userTargets] = await Promise.all([
    db
      .select({ departmentId: eventDepartmentTargetsTable.departmentId })
      .from(eventDepartmentTargetsTable)
      .where(eq(eventDepartmentTargetsTable.eventId, id)),
    db
      .select({ userId: eventUserTargetsTable.userId })
      .from(eventUserTargetsTable)
      .where(eq(eventUserTargetsTable.eventId, id)),
  ])

  const recipients = await resolveCommunicationRecipients({
    targetType: event.targetType,
    departmentIds: departmentTargets.map((target) => target.departmentId),
    userIds: userTargets.map((target) => target.userId),
  })

  const timeLabel = event.allDay
    ? new Date(event.startAt).toLocaleDateString()
    : `${new Date(event.startAt).toLocaleString()} - ${new Date(event.endAt).toLocaleString()}`

  await emitNotificationEvent({
    eventType,
    sourceType: 'event',
    sourceId: event.id,
    sourceKey: unique ? `${eventType}:event:${event.id}:${Date.now()}` : undefined,
    actorUserId,
    recipients: toNotificationRecipients(recipients),
    payload: {
      eventId: event.id,
      title: event.title,
      description: event.description,
      timeLabel,
      location: event.location,
      linkUrl: '/calendar',
    },
  })
}
