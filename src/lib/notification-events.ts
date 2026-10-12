import { and, asc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  departmentsTable,
  notificationEventOutboxTable,
  rolesTable,
  type NotificationOutboxDelivery,
  type NotificationOutboxPayload,
  type NotificationOutboxRecipient,
  usersTable,
} from '@/db/schema'
import { getDepartmentIdsWithAncestors } from '@/lib/department-hierarchy'
import { createRenderedNotifications } from '@/lib/notifications'
import { processWorkflowEvent } from '@/lib/workflows'

export const NOTIFICATION_EVENTS = {
  announcementPosted: 'announcement.posted',
  announcementMentioned: 'announcement.mentioned',
  calendarItemUpcoming: 'calendar_item.upcoming',
  calendarEventCreated: 'calendar_event.created',
  calendarEventUpdated: 'calendar_event.updated',
  calendarEventCancelled: 'calendar_event.cancelled',
  announcementCommentCreated: 'announcement.comment.created',
  announcementCommentMentioned: 'announcement.comment.mentioned',
  announcementReplyCreated: 'announcement.reply.created',
  leaveRequested: 'leave.requested',
  leaveStatusChanged: 'leave.status_changed',
  leaveUpdated: 'leave.updated',
  payrollGenerated: 'payroll.generated',
  payrollStatusChanged: 'payroll.status_changed',
  inventoryCreated: 'inventory.created',
  inventoryUpdated: 'inventory.updated',
  applicantCreated: 'applicant.created',
  employeeCreated: 'employee.created',
  expenseCreated: 'expense.created',
  expenseUpdated: 'expense.updated',
  expenseGenerationDue: 'expense.generation_due',
  expensePaymentDue: 'expense.payment_due',
  expensePaymentGenerated: 'expense.payment_generated',
} as const

export type NotificationEventType =
  (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS]

type EmitNotificationEventInput = {
  eventType: NotificationEventType | string
  sourceType: string
  sourceId: string
  sourceKey?: string
  actorUserId?: string | null
  recipients: NotificationOutboxRecipient[]
  payload: NotificationOutboxPayload
  delivery?: Partial<NotificationOutboxDelivery>
  processImmediately?: boolean
}

function getRetryAt(attempts: number) {
  const seconds = Math.min(3600, 60 * 2 ** Math.max(0, attempts - 1))
  return new Date(Date.now() + seconds * 1000).toISOString()
}

export async function emitNotificationEvent(input: EmitNotificationEventInput) {
  const recipients = input.recipients.filter((recipient) => recipient.id)

  const delivery: NotificationOutboxDelivery = {
    inApp: input.delivery?.inApp ?? true,
    email: input.delivery?.email ?? false,
  }

  const now = new Date().toISOString()
  const sourceKey = input.sourceKey || `${input.eventType}:${input.sourceType}:${input.sourceId}`
  const [created] = await db
    .insert(notificationEventOutboxTable)
    .values({
      eventType: input.eventType,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceKey,
      actorUserId: input.actorUserId || null,
      recipients,
      payload: input.payload,
      delivery,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning()

  if (created && input.processImmediately !== false) {
    await processNotificationEventOutboxRow(created.id).catch(() => undefined)
  }

  return created || null
}

export async function processNotificationEventOutboxRow(id: string) {
  const [row] = await db
    .select()
    .from(notificationEventOutboxTable)
    .where(eq(notificationEventOutboxTable.id, id))
    .limit(1)

  if (!row || row.status === 'processed') return row || null

  try {
    if (isAnnouncementEvent(row.eventType)) {
      await processAnnouncementNotificationEvent({
        eventType: row.eventType,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        actorUserId: row.actorUserId,
        recipients: row.recipients,
        payload: row.payload,
        delivery: row.delivery,
      })
    } else {
      await processWorkflowEvent({
        id: row.id,
        eventType: row.eventType,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        actorUserId: row.actorUserId,
        recipients: row.recipients,
        payload: row.payload,
      })
    }

    const [updated] = await db
      .update(notificationEventOutboxTable)
      .set({
        status: 'processed',
        processedAt: new Date().toISOString(),
        lastError: null,
        nextAttemptAt: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(notificationEventOutboxTable.id, row.id))
      .returning()

    return updated || row
  } catch (error) {
    const attempts = row.attempts + 1
    const [updated] = await db
      .update(notificationEventOutboxTable)
      .set({
        status: 'failed',
        attempts: sql`${notificationEventOutboxTable.attempts} + 1`,
        lastError: error instanceof Error ? error.message : 'Notification processing failed.',
        nextAttemptAt: getRetryAt(attempts),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(notificationEventOutboxTable.id, row.id))
      .returning()

    return updated || row
  }
}

function isAnnouncementEvent(eventType: string) {
  return eventType.startsWith('announcement.')
}

async function processAnnouncementNotificationEvent(input: {
  eventType: string
  sourceType: string
  sourceId: string
  actorUserId?: string | null
  recipients: NotificationOutboxRecipient[]
  payload: NotificationOutboxPayload
  delivery: NotificationOutboxDelivery
}) {
  if (input.recipients.length === 0) return

  const rendered = renderAnnouncementNotification(input.eventType, input.payload)

  await createRenderedNotifications({
    eventType: input.eventType,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    actorUserId: input.actorUserId || null,
    title: rendered.title.slice(0, 255),
    message: rendered.message,
    linkUrl: stringPayload(input.payload, 'linkUrl') || '/announcements',
    recipients: input.recipients.map((recipient) => ({
      id: recipient.id,
      email: recipient.email || '',
      fullName: recipient.fullName || '',
    })),
    metadata: input.payload,
    delivery: input.delivery,
  })
}

function renderAnnouncementNotification(eventType: string, payload: NotificationOutboxPayload) {
  const title = stringPayload(payload, 'title') || stringPayload(payload, 'announcementTitle') || 'Announcement'
  const body = stringPayload(payload, 'body')
  const actorName = stringPayload(payload, 'actorName') || 'Someone'

  if (eventType === NOTIFICATION_EVENTS.announcementMentioned) {
    return {
      title: `You were mentioned: ${title}`,
      message: body || `${actorName} mentioned you in an announcement.`,
    }
  }

  if (eventType === NOTIFICATION_EVENTS.announcementCommentCreated) {
    return {
      title: `${actorName} commented on an announcement`,
      message: [title, body].filter(Boolean).join('\n'),
    }
  }

  if (eventType === NOTIFICATION_EVENTS.announcementCommentMentioned) {
    return {
      title: `${actorName} mentioned you in a comment`,
      message: [title, body].filter(Boolean).join('\n'),
    }
  }

  return {
    title,
    message: body || title,
  }
}

function stringPayload(payload: NotificationOutboxPayload, key: string) {
  const value = payload[key]
  return value == null ? '' : String(value)
}

export async function processNotificationEventOutbox(limit = 50) {
  const now = new Date().toISOString()
  const rows = await db
    .select({ id: notificationEventOutboxTable.id })
    .from(notificationEventOutboxTable)
    .where(
      or(
        eq(notificationEventOutboxTable.status, 'pending'),
        and(
          eq(notificationEventOutboxTable.status, 'failed'),
          or(isNull(notificationEventOutboxTable.nextAttemptAt), lte(notificationEventOutboxTable.nextAttemptAt, now)),
        ),
      ),
    )
    .orderBy(asc(notificationEventOutboxTable.createdAt))
    .limit(limit)

  const result = { processed: 0, failed: 0, skipped: 0 }

  for (const row of rows) {
    const updated = await processNotificationEventOutboxRow(row.id)
    if (!updated) {
      result.skipped += 1
    } else if (updated.status === 'processed') {
      result.processed += 1
    } else if (updated.status === 'failed') {
      result.failed += 1
    } else {
      result.skipped += 1
    }
  }

  return result
}

export function toNotificationRecipients(
  recipients: Array<{ id: string; email?: string | null; fullName?: string | null }>,
) {
  const seen = new Set<string>()
  return recipients
    .filter((recipient) => {
      if (!recipient.id || seen.has(recipient.id)) return false
      seen.add(recipient.id)
      return true
    })
    .map((recipient) => ({
      id: recipient.id,
      email: recipient.email || null,
      fullName: recipient.fullName || null,
    }))
}

export async function getUsersByIdsForNotifications(userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (ids.length === 0) return []

  return db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      fullName: usersTable.fullName,
    })
    .from(usersTable)
    .where(and(eq(usersTable.isActive, true), inArray(usersTable.id, ids)))
}

export async function getFullAccessRecipientsForNotifications() {
  return db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      fullName: usersTable.fullName,
    })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .where(and(eq(usersTable.isActive, true), eq(rolesTable.name, 'admin')))
}

export async function getDepartmentManagerRecipientsForNotifications(departmentIds: string[]) {
  const ids = Array.from(new Set(departmentIds.filter(Boolean)))
  if (ids.length === 0) return []

  return db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      fullName: usersTable.fullName,
    })
    .from(departmentsTable)
    .innerJoin(usersTable, eq(departmentsTable.managerUserId, usersTable.id))
    .where(and(eq(usersTable.isActive, true), inArray(departmentsTable.id, ids)))
}

export async function getLeaveRecipientsForNotifications(employeeId: string) {
  const [employeeRecipients, employee] = await Promise.all([
    getUsersByIdsForNotifications([employeeId]),
    db
      .select({ departmentId: usersTable.departmentId })
      .from(usersTable)
      .where(eq(usersTable.id, employeeId))
      .limit(1),
  ])

  const departmentIds = await getDepartmentIdsWithAncestors(employee[0]?.departmentId)
  const managerRecipients = await getDepartmentManagerRecipientsForNotifications(departmentIds)
  const fallbackRecipients =
    managerRecipients.length > 0 ? [] : await getFullAccessRecipientsForNotifications()

  return toNotificationRecipients([
    ...employeeRecipients,
    ...managerRecipients,
    ...fallbackRecipients,
  ])
}
