'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { announcementMentionsTable, announcementsTable } from '@/db/schema'
import { requireAuth } from '@/lib/auth-guards'
import {
  getAnnouncementChannelById,
  getVisibleAnnouncementChannels,
  resolveAnnouncementCategoryId,
  resolveAnnouncementChannelRecipients,
} from '@/lib/announcement-categories'
import {
  emitNotificationEvent,
  NOTIFICATION_EVENTS,
  toNotificationRecipients,
} from '@/lib/notification-events'

function clean(value: FormDataEntryValue | null) {
  return String(value || '').trim()
}

function getAnnouncementValues(formData: FormData) {
  return {
    id: clean(formData.get('id')) || null,
    categoryId: clean(formData.get('categoryId')) || null,
    title: clean(formData.get('title')),
    body: clean(formData.get('body')),
  }
}

function validateAnnouncement(values: ReturnType<typeof getAnnouncementValues>) {
  if (!values.title) throw new Error('Title is required.')
  if (!values.body) throw new Error('Body is required.')
}

async function assertCanUseChannel(
  user: Awaited<ReturnType<typeof requireAuth>>,
  channelId: string,
) {
  const visibleChannels = await getVisibleAnnouncementChannels(user)
  if (!visibleChannels.some((channel) => channel.id === channelId)) {
    throw new Error('You cannot post in this channel.')
  }
}

export async function saveAnnouncementFormAction(formData: FormData) {
  const user = await requireAuth()
  const values = getAnnouncementValues(formData)
  const categoryId = await resolveAnnouncementCategoryId(values.categoryId)
  const channel = await getAnnouncementChannelById(categoryId)
  validateAnnouncement(values)
  if (!channel) throw new Error('Channel is required.')
  await assertCanUseChannel(user, channel.id)

  let announcementId = values.id

  if (announcementId) {
    const [existingAnnouncement] = await db
      .select({
        id: announcementsTable.id,
        createdById: announcementsTable.createdById,
        categoryId: announcementsTable.categoryId,
      })
      .from(announcementsTable)
      .where(eq(announcementsTable.id, announcementId))
      .limit(1)

    if (!existingAnnouncement) throw new Error('Announcement not found.')
    if (existingAnnouncement.createdById !== user.id) {
      throw new Error('Only the creator can edit this announcement.')
    }
    await assertCanUseChannel(user, existingAnnouncement.categoryId || '')

    await db
      .update(announcementsTable)
      .set({
        title: values.title,
        body: values.body,
        categoryId,
        targetType: channel.visibility === 'public' ? 'everyone' : 'users',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(announcementsTable.id, announcementId))
  } else {
    const [created] = await db
      .insert(announcementsTable)
      .values({
        title: values.title,
        body: values.body,
        categoryId,
        targetType: channel.visibility === 'public' ? 'everyone' : 'users',
        createdById: user.id,
      })
      .returning()

    announcementId = created.id
  }

  if (clean(formData.get('intent')) === 'send') {
    await sendAnnouncementByIdForUser(announcementId, user)
  }

  revalidatePath('/announcements')
  redirect('/announcements')
}

export async function sendAnnouncementAction(formData: FormData) {
  void formData
  throw new Error('Announcement approval is no longer required.')
}

export async function sendAnnouncementById(id: string) {
  const user = await requireAuth()
  return sendAnnouncementByIdForUser(id, user)
}

async function sendAnnouncementByIdForUser(
  id: string,
  user: Awaited<ReturnType<typeof requireAuth>>,
) {
  const [announcement] = await db
    .select()
    .from(announcementsTable)
    .where(eq(announcementsTable.id, id))
    .limit(1)

  if (!announcement) throw new Error('Announcement not found.')
  if (announcement.createdById !== user.id) {
    throw new Error('Only the creator can send this announcement.')
  }
  if (announcement.status === 'sent') return announcement

  const channel = await getAnnouncementChannelById(announcement.categoryId || '')
  if (!channel) throw new Error('Channel is required.')
  await assertCanUseChannel(user, channel.id)
  const recipients = await resolveAnnouncementChannelRecipients(channel)
  const mentionRows = await db
    .select({
      userId: announcementMentionsTable.userId,
    })
    .from(announcementMentionsTable)
    .where(eq(announcementMentionsTable.announcementId, announcement.id))

  await emitNotificationEvent({
    eventType: NOTIFICATION_EVENTS.announcementPosted,
    sourceType: 'announcement',
    sourceId: announcement.id,
    actorUserId: announcement.createdById,
    recipients: toNotificationRecipients(recipients),
    delivery: { inApp: true, email: false },
    payload: {
      announcementId: announcement.id,
      channelId: channel.id,
      channelName: channel.name,
      title: announcement.title,
      body: announcement.body,
      linkUrl: `/announcements/${announcement.id}`,
    },
  })

  const mentionedIds = new Set(mentionRows.map((mention) => mention.userId))
  const mentionedRecipients = recipients.filter(
    (recipient) => mentionedIds.has(recipient.id) && recipient.id !== announcement.createdById,
  )

  if (mentionedRecipients.length > 0) {
    await emitNotificationEvent({
      eventType: NOTIFICATION_EVENTS.announcementMentioned,
      sourceType: 'announcement',
      sourceId: announcement.id,
      sourceKey: `${NOTIFICATION_EVENTS.announcementMentioned}:announcement:${announcement.id}`,
      actorUserId: announcement.createdById,
      recipients: toNotificationRecipients(mentionedRecipients),
      delivery: { inApp: true, email: false },
      payload: {
        announcementId: announcement.id,
        channelId: channel.id,
        channelName: channel.name,
        title: announcement.title,
        body: announcement.body,
        linkUrl: `/announcements/${announcement.id}`,
      },
    })
  }

  const [updated] = await db
    .update(announcementsTable)
    .set({
      status: 'sent',
      sentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(announcementsTable.id, id))
    .returning()

  return updated
}
