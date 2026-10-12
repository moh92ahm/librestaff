import { and, count, desc, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import {
  notificationEmailDeliveriesTable,
  notificationsTable,
  usersTable,
  type notificationSourceTypeEnum,
} from '@/db/schema'
import { getEnabledEmailSettings, validateEmailSettingsValues } from '@/lib/email-settings'
import { sendEmail } from '@/lib/email-sender'
import type { CommunicationRecipient } from '@/lib/communication-recipients'

export type NotificationSourceType = (typeof notificationSourceTypeEnum.enumValues)[number]

export type CreateSourceNotificationsInput = {
  sourceType: NotificationSourceType | string
  sourceId: string
  title: string
  message: string
  linkUrl: string
  recipients: CommunicationRecipient[]
}

export type CreateRenderedNotificationsInput = CreateSourceNotificationsInput & {
  eventType?: string
  actorUserId?: string | null
  metadata?: Record<string, unknown> | null
  delivery?: {
    inApp: boolean
    email: boolean
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function assertEmailReadyIfEnabled() {
  const settings = await getEnabledEmailSettings()
  if (!settings) return false

  validateEmailSettingsValues(settings, { requireAuthSecrets: true })
  return true
}

export async function createSourceNotifications(input: CreateSourceNotificationsInput) {
  return createRenderedNotifications({
    ...input,
    delivery: { inApp: true, email: true },
  })
}

export async function createRenderedNotifications(input: CreateRenderedNotificationsInput) {
  if (input.recipients.length === 0) {
    throw new Error('No recipients found.')
  }

  const delivery = input.delivery || { inApp: true, email: true }
  if (!delivery.inApp && !delivery.email) return []

  const emailEnabled = delivery.email ? await assertEmailReadyIfEnabled() : false
  const hiddenAt = delivery.inApp ? null : new Date().toISOString()

  const notifications = await db.transaction(async (tx) => {
    const created = await tx
      .insert(notificationsTable)
      .values(
        input.recipients.map((recipient) => ({
          recipientUserId: recipient.id,
          eventType: input.eventType || 'legacy.notification',
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          actorUserId: input.actorUserId || null,
          title: input.title,
          message: input.message,
          linkUrl: input.linkUrl,
          metadata: input.metadata || null,
          archivedAt: hiddenAt,
        })),
      )
      .returning()

    if (delivery.email) {
      await tx.insert(notificationEmailDeliveriesTable).values(
        created.map((notification) => {
          const recipient = input.recipients.find(
            (item) => item.id === notification.recipientUserId,
          )
          const status = emailEnabled ? ('pending' as const) : ('skipped' as const)

          return {
            notificationId: notification.id,
            recipientEmail: recipient?.email || '',
            status,
            error: emailEnabled ? null : 'Email sending is disabled.',
          }
        }),
      )
    }

    return created
  })

  if (!delivery.email || !emailEnabled) {
    return notifications
  }

  await Promise.all(
    notifications.map(async (notification) => {
      const recipient = input.recipients.find((item) => item.id === notification.recipientUserId)
      if (!recipient) return

      const [delivery] = await db
        .select()
        .from(notificationEmailDeliveriesTable)
        .where(eq(notificationEmailDeliveriesTable.notificationId, notification.id))
        .limit(1)

      if (!delivery) return

      try {
        await sendEmail({
          to: recipient.email,
          subject: input.title,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
              <h1 style="font-size: 20px;">${escapeHtml(input.title)}</h1>
              <p>${escapeHtml(input.message).replace(/\n/g, '<br>')}</p>
              <p><a href="${escapeHtml(input.linkUrl)}">Open in LibreStaff</a></p>
            </div>
          `,
          text: `${input.message}\n\n${input.linkUrl}`,
        })

        await db
          .update(notificationEmailDeliveriesTable)
          .set({
            status: 'sent',
            sentAt: new Date().toISOString(),
            error: null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(notificationEmailDeliveriesTable.id, delivery.id))
      } catch (error) {
        await db
          .update(notificationEmailDeliveriesTable)
          .set({
            status: 'failed',
            error: error instanceof Error ? error.message : 'Email sending failed.',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(notificationEmailDeliveriesTable.id, delivery.id))
      }
    }),
  )

  return notifications
}

export async function getNotificationSummary(userId: string) {
  const [unread] = await db
    .select({ count: count() })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.recipientUserId, userId),
        isNull(notificationsTable.readAt),
        isNull(notificationsTable.archivedAt),
      ),
    )

  const items = await db
    .select({
      id: notificationsTable.id,
      title: notificationsTable.title,
      message: notificationsTable.message,
      linkUrl: notificationsTable.linkUrl,
      readAt: notificationsTable.readAt,
      createdAt: notificationsTable.createdAt,
      sourceType: notificationsTable.sourceType,
    })
    .from(notificationsTable)
    .where(
      and(eq(notificationsTable.recipientUserId, userId), isNull(notificationsTable.archivedAt)),
    )
    .orderBy(desc(notificationsTable.createdAt))
    .limit(10)

  return {
    unreadCount: Number(unread?.count || 0),
    items,
  }
}

export async function getAllNotifications(userId: string) {
  return db
    .select({
      id: notificationsTable.id,
      title: notificationsTable.title,
      message: notificationsTable.message,
      linkUrl: notificationsTable.linkUrl,
      readAt: notificationsTable.readAt,
      createdAt: notificationsTable.createdAt,
      sourceType: notificationsTable.sourceType,
    })
    .from(notificationsTable)
    .where(
      and(eq(notificationsTable.recipientUserId, userId), isNull(notificationsTable.archivedAt)),
    )
    .orderBy(desc(notificationsTable.createdAt))
}

export async function getNotificationsPage(userId: string, requestedPage: number, pageSize = 20) {
  const where = and(
    eq(notificationsTable.recipientUserId, userId),
    isNull(notificationsTable.archivedAt),
  )
  const unreadWhere = and(where, isNull(notificationsTable.readAt))
  const [[totalRow], [unreadRow]] = await Promise.all([
    db.select({ count: count() }).from(notificationsTable).where(where),
    db.select({ count: count() }).from(notificationsTable).where(unreadWhere),
  ])

  const totalItems = Number(totalRow?.count || 0)
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(Math.max(1, requestedPage), totalPages)
  const items = await db
    .select({
      id: notificationsTable.id,
      title: notificationsTable.title,
      message: notificationsTable.message,
      linkUrl: notificationsTable.linkUrl,
      readAt: notificationsTable.readAt,
      createdAt: notificationsTable.createdAt,
      sourceType: notificationsTable.sourceType,
    })
    .from(notificationsTable)
    .where(where)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize)

  return {
    items,
    currentPage,
    totalPages,
    totalItems,
    unreadCount: Number(unreadRow?.count || 0),
  }
}

export async function markNotificationRead(notificationId: string, userId: string) {
  await db
    .update(notificationsTable)
    .set({ readAt: new Date().toISOString() })
    .where(
      and(
        eq(notificationsTable.id, notificationId),
        eq(notificationsTable.recipientUserId, userId),
      ),
    )

  revalidatePath('/')
  revalidatePath('/me')
  revalidatePath('/notifications')
}

export async function markAllNotificationsRead(userId: string) {
  await db
    .update(notificationsTable)
    .set({ readAt: new Date().toISOString() })
    .where(and(eq(notificationsTable.recipientUserId, userId), isNull(notificationsTable.readAt)))

  revalidatePath('/')
  revalidatePath('/me')
  revalidatePath('/notifications')
}

export async function getNotificationRecipientOptions() {
  return db
    .select({
      value: usersTable.id,
      label: usersTable.fullName,
    })
    .from(usersTable)
    .where(eq(usersTable.isActive, true))
    .orderBy(usersTable.fullName)
}
