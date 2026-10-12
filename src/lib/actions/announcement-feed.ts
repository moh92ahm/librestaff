'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, inArray, ne } from 'drizzle-orm'
import { db } from '@/db'
import {
  announcementAttachmentsTable,
  announcementCategoriesTable,
  announcementChannelDepartmentMembersTable,
  announcementChannelUserMembersTable,
  announcementCommentAttachmentsTable,
  announcementCommentReactionsTable,
  announcementCommentsTable,
  announcementMentionsTable,
  announcementReactionsTable,
  announcementsTable,
  usersTable,
} from '@/db/schema'
import { requireAuth } from '@/lib/auth-guards'
import { requirePermission } from '@/lib/permissions'
import { canManageAnnouncementChannel } from '@/lib/manager-permissions'
import type { User } from '@/lib/rbac'
import { uniqueIds } from '@/lib/communication-recipients'
import {
  getAnnouncementChannelById,
  getVisibleAnnouncementChannels,
  isGeneralAnnouncementCategory,
  resolveAnnouncementCategoryId,
  resolveAnnouncementChannelRecipients,
} from '@/lib/announcement-categories'
import {
  emitNotificationEvent,
  NOTIFICATION_EVENTS,
  toNotificationRecipients,
} from '@/lib/notification-events'
import { documentMimeTypes, imageMimeTypes, saveUploadedMedia } from '@/lib/media-storage'

function clean(value: FormDataEntryValue | null) {
  return String(value || '').trim()
}

function formIds(formData: FormData, key: string) {
  return uniqueIds(formData.getAll(key).map((value) => String(value)))
}

function indexedFormValues(formData: FormData, key: string) {
  return Array.from(formData.entries())
    .filter(([name]) => name === key || name.startsWith(`${key}[`))
    .map(([, value]) => value)
}

function isUploadedFile(value: FormDataEntryValue): value is File {
  return (
    typeof value === 'object' &&
    value !== null &&
    'arrayBuffer' in value &&
    'name' in value &&
    'size' in value &&
    typeof value.name === 'string' &&
    value.size > 0
  )
}

async function uploadAnnouncementAttachment(file: File) {
  const media = await saveUploadedMedia({
    file,
    category: 'announcement-attachments',
    allowedMimeTypes: [...imageMimeTypes, ...documentMimeTypes],
    alt: file.name,
  })
  return media.id
}

async function resolveAttachmentMediaIds(formData: FormData) {
  const attachmentValues = indexedFormValues(formData, 'attachments')
  const mediaIds: string[] = []

  for (const value of attachmentValues) {
    if (isUploadedFile(value)) {
      mediaIds.push(await uploadAnnouncementAttachment(value))
      continue
    }

    const mediaId = clean(value)
    if (mediaId) mediaIds.push(mediaId)
  }

  return uniqueIds(mediaIds)
}

async function replaceAnnouncementAttachments(announcementId: string, mediaIds: string[]) {
  await db.transaction(async (tx) => {
    await tx
      .delete(announcementAttachmentsTable)
      .where(eq(announcementAttachmentsTable.announcementId, announcementId))

    if (mediaIds.length > 0) {
      await tx.insert(announcementAttachmentsTable).values(
        mediaIds.map((mediaId) => ({
          announcementId,
          mediaId,
        })),
      )
    }
  })
}

async function insertCommentAttachments(commentId: string, mediaIds: string[]) {
  if (mediaIds.length === 0) return

  await db.insert(announcementCommentAttachmentsTable).values(
    mediaIds.map((mediaId) => ({
      commentId,
      mediaId,
    })),
  )
}

async function replaceAnnouncementMentions(
  announcementId: string,
  mentions: Array<{ id: string; label: string }>,
) {
  await db.transaction(async (tx) => {
    await tx
      .delete(announcementMentionsTable)
      .where(eq(announcementMentionsTable.announcementId, announcementId))

    if (mentions.length > 0) {
      await tx.insert(announcementMentionsTable).values(
        mentions.map((mention) => ({
          announcementId,
          userId: mention.id,
          label: mention.label,
        })),
      )
    }
  })
}

async function getAnnouncementMentionIds(announcementId: string) {
  const rows = await db
    .select({ userId: announcementMentionsTable.userId })
    .from(announcementMentionsTable)
    .where(eq(announcementMentionsTable.announcementId, announcementId))

  return rows.map((row) => row.userId)
}

async function replaceChannelMembers(
  channelId: string,
  departmentIds: string[],
  userIds: string[],
) {
  await db.transaction(async (tx) => {
    await tx
      .delete(announcementChannelDepartmentMembersTable)
      .where(eq(announcementChannelDepartmentMembersTable.channelId, channelId))
    await tx
      .delete(announcementChannelUserMembersTable)
      .where(eq(announcementChannelUserMembersTable.channelId, channelId))

    if (departmentIds.length > 0) {
      await tx.insert(announcementChannelDepartmentMembersTable).values(
        departmentIds.map((departmentId) => ({
          channelId,
          departmentId,
        })),
      )
    }

    if (userIds.length > 0) {
      await tx.insert(announcementChannelUserMembersTable).values(
        userIds.map((userId) => ({
          channelId,
          userId,
        })),
      )
    }
  })
}

async function assertCanAccessChannel(user: User, channelId: string) {
  const visibleChannels = await getVisibleAnnouncementChannels(user)
  if (!visibleChannels.some((channel) => channel.id === channelId)) {
    throw new Error('You cannot access this channel.')
  }
}

async function assertCanPostInChannel(user: User, channelId: string) {
  try {
    await assertCanAccessChannel(user, channelId)
  } catch {
    throw new Error('You cannot post in this channel.')
  }
}

async function assertCanAccessAnnouncement(user: User, announcementId: string) {
  const [announcement] = await db
    .select({
      id: announcementsTable.id,
      categoryId: announcementsTable.categoryId,
    })
    .from(announcementsTable)
    .where(eq(announcementsTable.id, announcementId))
    .limit(1)

  if (!announcement) {
    throw new Error('Announcement not found.')
  }

  await assertCanAccessChannel(user, announcement.categoryId || '')
  return announcement
}

export async function postAnnouncementAction(formData: FormData) {
  const user = await requireAuth()

  const title = clean(formData.get('title'))
  const body = clean(formData.get('body'))
  const categoryId = await resolveAnnouncementCategoryId(clean(formData.get('categoryId')))
  const intent = clean(formData.get('intent'))
  const notifyByEmail = intent === 'post' && formData.get('notifyByEmail') === 'on'
  const mentionedUserIds = formIds(formData, 'mentionedUserIds')
  const attachmentMediaIds = await resolveAttachmentMediaIds(formData)
  const channel = await getAnnouncementChannelById(categoryId)

  if (!title) throw new Error('Title is required.')
  if (!body) throw new Error('Body is required.')
  if (!channel) throw new Error('Channel is required.')
  await assertCanPostInChannel(user, channel.id)

  const status = intent === 'post' ? 'sent' : 'draft'
  const sentAt = intent === 'post' ? new Date().toISOString() : null

  const [announcement] = await db
    .insert(announcementsTable)
    .values({
      title,
      body,
      categoryId,
      status,
      sentAt,
      targetType: channel.visibility === 'public' ? 'everyone' : 'users',
      createdById: user.id,
    })
    .returning()

  await replaceAnnouncementAttachments(announcement.id, attachmentMediaIds)
  const recipients = await resolveAnnouncementChannelRecipients(channel)
  const mentionedRecipientIds = new Set(mentionedUserIds)
  const mentionedRecipients = recipients.filter((recipient) =>
    mentionedRecipientIds.has(recipient.id),
  )
  await replaceAnnouncementMentions(
    announcement.id,
    mentionedRecipients.map((recipient) => ({ id: recipient.id, label: recipient.fullName })),
  )

  if (intent === 'post') {
    if (recipients.length > 0) {
      await emitNotificationEvent({
        eventType: NOTIFICATION_EVENTS.announcementPosted,
        sourceType: 'announcement',
        sourceId: announcement.id,
        actorUserId: user.id,
        recipients: toNotificationRecipients(recipients),
        delivery: {
          inApp: true,
          email: notifyByEmail,
        },
        payload: {
          announcementId: announcement.id,
          channelId: channel.id,
          channelName: channel.name,
          title: announcement.title,
          body: announcement.body,
          linkUrl: `/announcements/${announcement.id}`,
        },
      })

      const mentionNotificationRecipients = mentionedRecipients.filter(
        (recipient) => mentionedRecipientIds.has(recipient.id) && recipient.id !== user.id,
      )

      if (mentionNotificationRecipients.length > 0) {
        await emitNotificationEvent({
          eventType: NOTIFICATION_EVENTS.announcementMentioned,
          sourceType: 'announcement',
          sourceId: announcement.id,
          sourceKey: `${NOTIFICATION_EVENTS.announcementMentioned}:announcement:${announcement.id}`,
          actorUserId: user.id,
          recipients: toNotificationRecipients(mentionNotificationRecipients),
          delivery: { inApp: true, email: false },
          payload: {
            announcementId: announcement.id,
            channelId: channel.id,
            channelName: channel.name,
            actorName: user.name || 'Someone',
            title: announcement.title,
            body: announcement.body,
            linkUrl: `/announcements/${announcement.id}`,
          },
        })
      }
    }
  }

  revalidatePath('/announcements')
}

export async function updateAnnouncementAction(formData: FormData) {
  const user = await requireAuth()

  const id = clean(formData.get('id'))
  const title = clean(formData.get('title'))
  const body = clean(formData.get('body'))
  const categoryId = await resolveAnnouncementCategoryId(clean(formData.get('categoryId')))
  const attachmentMediaIds = await resolveAttachmentMediaIds(formData)
  const mentionedUserIds = formIds(formData, 'mentionedUserIds')
  const channel = await getAnnouncementChannelById(categoryId)

  if (!id) throw new Error('Announcement ID is required.')
  if (!title) throw new Error('Title is required.')
  if (!body) throw new Error('Body is required.')
  if (!channel) throw new Error('Channel is required.')
  await assertCanPostInChannel(user, channel.id)

  const [announcement] = await db
    .select({
      id: announcementsTable.id,
      createdById: announcementsTable.createdById,
      categoryId: announcementsTable.categoryId,
      status: announcementsTable.status,
    })
    .from(announcementsTable)
    .where(eq(announcementsTable.id, id))
    .limit(1)

  if (!announcement) throw new Error('Announcement not found.')
  if (announcement.createdById !== user.id) {
    throw new Error('Only the creator can edit this announcement.')
  }
  await assertCanAccessChannel(user, announcement.categoryId || '')

  const existingMentionIds = await getAnnouncementMentionIds(id)
  const recipients = await resolveAnnouncementChannelRecipients(channel)
  const mentionedRecipientIds = new Set(mentionedUserIds)
  const mentionedRecipients = recipients.filter((recipient) =>
    mentionedRecipientIds.has(recipient.id),
  )

  await db
    .update(announcementsTable)
    .set({
      title,
      body,
      categoryId,
      targetType: channel.visibility === 'public' ? 'everyone' : 'users',
      updatedAt: new Date().toISOString(),
    })
    .where(eq(announcementsTable.id, id))

  await replaceAnnouncementAttachments(id, attachmentMediaIds)
  await replaceAnnouncementMentions(
    id,
    mentionedRecipients.map((recipient) => ({ id: recipient.id, label: recipient.fullName })),
  )

  if (announcement.status === 'sent') {
    const existingMentionIdSet = new Set(existingMentionIds)
    const newMentionRecipients = mentionedRecipients.filter(
      (recipient) => !existingMentionIdSet.has(recipient.id) && recipient.id !== user.id,
    )

    if (newMentionRecipients.length > 0) {
      await emitNotificationEvent({
        eventType: NOTIFICATION_EVENTS.announcementMentioned,
        sourceType: 'announcement',
        sourceId: id,
        sourceKey: `${NOTIFICATION_EVENTS.announcementMentioned}:announcement:${id}:${Date.now()}`,
        actorUserId: user.id,
        recipients: toNotificationRecipients(newMentionRecipients),
        delivery: { inApp: true, email: false },
        payload: {
          announcementId: id,
          channelId: channel.id,
          channelName: channel.name,
          actorName: user.name || 'Someone',
          title,
          body,
          linkUrl: `/announcements/${id}`,
        },
      })
    }
  }

  revalidatePath('/announcements')
  revalidatePath('/announcements')
}

export async function toggleReactionAction(formData: FormData) {
  const user = await requireAuth()
  const announcementId = clean(formData.get('announcementId'))
  const emoji = clean(formData.get('emoji'))

  if (!announcementId || !emoji) return

  // Find any existing reaction by this user on this announcement (one reaction max)
  const [existing] = await db
    .select({ id: announcementReactionsTable.id, emoji: announcementReactionsTable.emoji })
    .from(announcementReactionsTable)
    .where(
      and(
        eq(announcementReactionsTable.announcementId, announcementId),
        eq(announcementReactionsTable.userId, user.id),
      ),
    )
    .limit(1)

  if (existing) {
    // Same emoji → remove (toggle off); different emoji → remove old, add new
    await db
      .delete(announcementReactionsTable)
      .where(eq(announcementReactionsTable.id, existing.id))
    if (existing.emoji !== emoji) {
      await db.insert(announcementReactionsTable).values({ announcementId, userId: user.id, emoji })
    }
  } else {
    await db.insert(announcementReactionsTable).values({ announcementId, userId: user.id, emoji })
  }

  revalidatePath('/announcements')
  revalidatePath('/announcements')
}

export async function toggleCommentReactionAction(formData: FormData) {
  const user = await requireAuth()
  const commentId = clean(formData.get('commentId'))
  const emoji = clean(formData.get('emoji'))

  if (!commentId || !emoji) return

  const [existing] = await db
    .select({
      id: announcementCommentReactionsTable.id,
      emoji: announcementCommentReactionsTable.emoji,
    })
    .from(announcementCommentReactionsTable)
    .where(
      and(
        eq(announcementCommentReactionsTable.commentId, commentId),
        eq(announcementCommentReactionsTable.userId, user.id),
      ),
    )
    .limit(1)

  if (existing) {
    await db
      .delete(announcementCommentReactionsTable)
      .where(eq(announcementCommentReactionsTable.id, existing.id))
    if (existing.emoji !== emoji) {
      await db.insert(announcementCommentReactionsTable).values({
        commentId,
        userId: user.id,
        emoji,
      })
    }
  } else {
    await db.insert(announcementCommentReactionsTable).values({
      commentId,
      userId: user.id,
      emoji,
    })
  }

  revalidatePath('/announcements')
  revalidatePath('/announcements')
}

export async function addCommentAction(formData: FormData) {
  const user = await requireAuth()
  const announcementId = clean(formData.get('announcementId'))
  const body = clean(formData.get('body'))
  const mentionedUserIds = formIds(formData, 'mentionedUserIds')
  const attachmentMediaIds = await resolveAttachmentMediaIds(formData)

  if (!announcementId) throw new Error('Announcement ID is required.')
  if (!body) throw new Error('Comment body is required.')

  const [createdComment] = await db
    .insert(announcementCommentsTable)
    .values({
      announcementId,
      userId: user.id,
      body,
    })
    .returning()
  await insertCommentAttachments(createdComment.id, attachmentMediaIds)

  const [announcement] = await db
    .select({
      id: announcementsTable.id,
      title: announcementsTable.title,
      createdById: announcementsTable.createdById,
      categoryId: announcementsTable.categoryId,
    })
    .from(announcementsTable)
    .where(eq(announcementsTable.id, announcementId))
    .limit(1)

  if (announcement) {
    const channel = announcement.categoryId
      ? await getAnnouncementChannelById(announcement.categoryId)
      : null
    const channelRecipients = channel ? await resolveAnnouncementChannelRecipients(channel) : []
    const mentionedRecipientIds = new Set(mentionedUserIds)
    const mentionedRecipients = channelRecipients.filter(
      (recipient) => mentionedRecipientIds.has(recipient.id) && recipient.id !== user.id,
    )
    const mentionedRecipientIdSet = new Set(mentionedRecipients.map((recipient) => recipient.id))

    const participantRows = await db
      .select({ userId: announcementCommentsTable.userId })
      .from(announcementCommentsTable)
      .where(
        and(
          eq(announcementCommentsTable.announcementId, announcementId),
          ne(announcementCommentsTable.userId, user.id),
        ),
      )

    const recipientIds = uniqueIds([
      announcement.createdById,
      ...participantRows.map((row) => row.userId),
    ]).filter((recipientId) => recipientId !== user.id && !mentionedRecipientIdSet.has(recipientId))

    if (recipientIds.length > 0) {
      const recipients = await db
        .select({
          id: usersTable.id,
          fullName: usersTable.fullName,
          email: usersTable.email,
        })
        .from(usersTable)
        .where(and(eq(usersTable.isActive, true), inArray(usersTable.id, recipientIds)))

      await emitNotificationEvent({
        eventType: NOTIFICATION_EVENTS.announcementCommentCreated,
        sourceType: 'announcement_comment',
        sourceId: createdComment.id,
        sourceKey: `${NOTIFICATION_EVENTS.announcementCommentCreated}:${createdComment.id}`,
        actorUserId: user.id,
        recipients: toNotificationRecipients(recipients),
        delivery: { inApp: true, email: false },
        payload: {
          commentId: createdComment.id,
          announcementId,
          announcementTitle: announcement.title,
          actorName: user.name || 'Someone',
          body,
          linkUrl: `/announcements/${announcementId}`,
        },
      })
    }

    if (mentionedRecipients.length > 0) {
      await emitNotificationEvent({
        eventType: NOTIFICATION_EVENTS.announcementCommentMentioned,
        sourceType: 'announcement_comment',
        sourceId: createdComment.id,
        sourceKey: `${NOTIFICATION_EVENTS.announcementCommentMentioned}:${createdComment.id}`,
        actorUserId: user.id,
        recipients: toNotificationRecipients(mentionedRecipients),
        delivery: { inApp: true, email: false },
        payload: {
          commentId: createdComment.id,
          announcementId,
          announcementTitle: announcement.title,
          actorName: user.name || 'Someone',
          body,
          linkUrl: `/announcements/${announcementId}`,
        },
      })
    }
  }

  revalidatePath('/announcements')
  revalidatePath('/announcements')
}

export async function pinAnnouncementAction(formData: FormData) {
  const user = await requireAuth()
  const id = clean(formData.get('id'))
  const pinned = clean(formData.get('pinned')) === 'true'

  if (!id) throw new Error('Announcement ID is required.')
  await assertCanAccessAnnouncement(user, id)

  await db
    .update(announcementsTable)
    .set({ pinned, updatedAt: new Date().toISOString() })
    .where(eq(announcementsTable.id, id))

  revalidatePath('/announcements')
}

export async function saveCategoryAction(formData: FormData) {
  const id = clean(formData.get('id')) || null
  const user = await requirePermission('announcements', id ? 'edit' : 'create')
  const redirectTo = clean(formData.get('redirectTo'))
  const name = clean(formData.get('name'))
  const color = clean(formData.get('color')) || '#6366f1'
  const visibility = clean(formData.get('visibility')) === 'private' ? 'private' : 'public'
  const departmentIds = visibility === 'private' ? formIds(formData, 'departmentIds') : []
  const userIds = visibility === 'private' ? formIds(formData, 'userIds') : []

  if (!name) throw new Error('Channel name is required.')
  if (visibility === 'private' && departmentIds.length === 0 && userIds.length === 0) {
    throw new Error('Private channels need at least one department or member.')
  }

  if (id) {
    const [existing] = await db
      .select({
        id: announcementCategoriesTable.id,
        name: announcementCategoriesTable.name,
        createdById: announcementCategoriesTable.createdById,
      })
      .from(announcementCategoriesTable)
      .where(eq(announcementCategoriesTable.id, id))
      .limit(1)

    if (!existing) {
      throw new Error('Channel not found.')
    }

    if (isGeneralAnnouncementCategory(existing)) {
      throw new Error('General category cannot be edited.')
    }
    if (!canManageAnnouncementChannel(user, existing)) {
      throw new Error('You can only edit channels you created.')
    }

    await db
      .update(announcementCategoriesTable)
      .set({
        name,
        color,
        visibility,
        notifyInApp: true,
        notifyEmail: false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(announcementCategoriesTable.id, id))
    await replaceChannelMembers(id, departmentIds, userIds)
  } else {
    const [created] = await db
      .insert(announcementCategoriesTable)
      .values({
        name,
        color,
        visibility,
        notifyInApp: true,
        notifyEmail: false,
        createdById: user.id,
      })
      .returning()
    await replaceChannelMembers(created.id, departmentIds, userIds)
  }

  revalidatePath('/announcements')
  revalidatePath('/announcements/channels')
  if (redirectTo) redirect(redirectTo)
}

export async function deleteCategoryAction(formData: FormData) {
  const user = await requirePermission('announcements', 'delete')
  const id = clean(formData.get('id'))
  const redirectTo = clean(formData.get('redirectTo'))
  if (!id) throw new Error('Category ID is required.')

  const [category] = await db
    .select({
      id: announcementCategoriesTable.id,
      name: announcementCategoriesTable.name,
      createdById: announcementCategoriesTable.createdById,
    })
    .from(announcementCategoriesTable)
    .where(eq(announcementCategoriesTable.id, id))
    .limit(1)

  if (!category) {
    throw new Error('Channel not found.')
  }

  if (isGeneralAnnouncementCategory(category)) {
    throw new Error('General channel cannot be deleted.')
  }
  if (!canManageAnnouncementChannel(user, category)) {
    throw new Error('You can only delete channels you created.')
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(announcementChannelDepartmentMembersTable)
      .where(eq(announcementChannelDepartmentMembersTable.channelId, id))
    await tx
      .delete(announcementChannelUserMembersTable)
      .where(eq(announcementChannelUserMembersTable.channelId, id))
    await tx.delete(announcementCategoriesTable).where(eq(announcementCategoriesTable.id, id))
  })

  revalidatePath('/announcements')
  revalidatePath('/announcements/channels')
  if (redirectTo) redirect(redirectTo)
}
