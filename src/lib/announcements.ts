import { and, count, desc, eq, getTableColumns, inArray, or } from 'drizzle-orm'
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
  mediaTable,
  usersTable,
} from '@/db/schema'
import { hasFullAccess, type User } from '@/lib/rbac'
import { getVisibleAnnouncementChannels } from '@/lib/announcement-categories'

export type AnnouncementFeedItem = {
  id: string
  title: string
  body: string
  status: 'draft' | 'sent' | 'archived'
  targetType: 'everyone' | 'departments' | 'users'
  pinned: boolean
  sentAt: string | null
  createdAt: string
  createdById: string
  creatorName: string
  creatorPhoto: string | null
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
  channelVisibility: 'public' | 'private' | null
  departmentIds: string[]
  userIds: string[]
  attachments: AnnouncementAttachment[]
  mentions: AnnouncementMention[]
  reactionCounts: Record<string, number>
  myReactions: string[]
  commentCount: number
  comments: AnnouncementComment[]
}

export type AnnouncementComment = {
  id: string
  userId: string
  authorName: string
  authorPhoto: string | null
  body: string
  createdAt: string
  attachments: AnnouncementAttachment[]
  reactionCounts: Record<string, number>
  myReactions: string[]
}

export type AnnouncementAttachment = {
  id: string
  mediaId: string
  filename: string
  mimeType: string
  filesize: number
  url: string
}

export type AnnouncementMention = {
  id: string
  label: string
}

async function getVisibleSentAnnouncementIds(user: User): Promise<string[] | null> {
  if (hasFullAccess(user)) return null

  const visibleChannels = await getVisibleAnnouncementChannels(user)
  const channelIds = visibleChannels.map((channel) => channel.id)
  if (channelIds.length === 0) return []

  const rows = await db
    .select({ id: announcementsTable.id })
    .from(announcementsTable)
    .where(inArray(announcementsTable.categoryId, channelIds))

  return rows.map((row) => row.id)
}

export async function getVisibleAnnouncementForUser(id: string, user: User) {
  const [announcement] = await db
    .select()
    .from(announcementsTable)
    .where(eq(announcementsTable.id, id))
    .limit(1)

  if (!announcement || announcement.status !== 'sent') {
    return null
  }

  if (hasFullAccess(user)) {
    return announcement
  }

  const visibleChannels = await getVisibleAnnouncementChannels(user)
  return visibleChannels.some((channel) => channel.id === announcement.categoryId)
    ? announcement
    : null
}

export async function getAnnouncementFeed(user: User): Promise<AnnouncementFeedItem[]> {
  const targetedIds = await getVisibleSentAnnouncementIds(user)

  let rows: Array<
    typeof announcementsTable.$inferSelect & {
      creatorName: string | null
      creatorPhoto: string | null
      categoryName: string | null
      categoryColor: string | null
      channelVisibility: 'public' | 'private' | null
    }
  >

  if (targetedIds === null) {
    rows = await db
      .select({
        ...getTableColumns(announcementsTable),
        creatorName: usersTable.fullName,
        creatorPhoto: usersTable.photo,
        categoryName: announcementCategoriesTable.name,
        categoryColor: announcementCategoriesTable.color,
        channelVisibility: announcementCategoriesTable.visibility,
      })
      .from(announcementsTable)
      .leftJoin(usersTable, eq(announcementsTable.createdById, usersTable.id))
      .leftJoin(
        announcementCategoriesTable,
        eq(announcementsTable.categoryId, announcementCategoriesTable.id),
      )
      .where(eq(announcementsTable.status, 'sent'))
      .orderBy(desc(announcementsTable.sentAt))
  } else {
    const conditions = [eq(announcementsTable.targetType, 'everyone')]
    if (targetedIds.length > 0) {
      conditions.push(inArray(announcementsTable.id, targetedIds))
    }

    rows = await db
      .select({
        ...getTableColumns(announcementsTable),
        creatorName: usersTable.fullName,
        creatorPhoto: usersTable.photo,
        categoryName: announcementCategoriesTable.name,
        categoryColor: announcementCategoriesTable.color,
        channelVisibility: announcementCategoriesTable.visibility,
      })
      .from(announcementsTable)
      .leftJoin(usersTable, eq(announcementsTable.createdById, usersTable.id))
      .leftJoin(
        announcementCategoriesTable,
        eq(announcementsTable.categoryId, announcementCategoriesTable.id),
      )
      .where(and(eq(announcementsTable.status, 'sent'), or(...conditions)))
      .orderBy(desc(announcementsTable.sentAt))
  }

  if (rows.length === 0) return []

  const announcementIds = rows.map((r) => r.id)

  const [
    reactions,
    myReactionsRows,
    commentCountRows,
    comments,
    departmentTargets,
    userTargets,
    attachments,
    mentions,
  ] = await Promise.all([
    db
      .select({
        announcementId: announcementReactionsTable.announcementId,
        emoji: announcementReactionsTable.emoji,
        cnt: count(),
      })
      .from(announcementReactionsTable)
      .where(inArray(announcementReactionsTable.announcementId, announcementIds))
      .groupBy(announcementReactionsTable.announcementId, announcementReactionsTable.emoji),
    db
      .select({
        announcementId: announcementReactionsTable.announcementId,
        emoji: announcementReactionsTable.emoji,
      })
      .from(announcementReactionsTable)
      .where(
        and(
          inArray(announcementReactionsTable.announcementId, announcementIds),
          eq(announcementReactionsTable.userId, user.id),
        ),
      ),
    db
      .select({
        announcementId: announcementCommentsTable.announcementId,
        cnt: count(),
      })
      .from(announcementCommentsTable)
      .where(inArray(announcementCommentsTable.announcementId, announcementIds))
      .groupBy(announcementCommentsTable.announcementId),
    db
      .select({
        id: announcementCommentsTable.id,
        announcementId: announcementCommentsTable.announcementId,
        userId: announcementCommentsTable.userId,
        body: announcementCommentsTable.body,
        createdAt: announcementCommentsTable.createdAt,
        authorName: usersTable.fullName,
        authorPhoto: usersTable.photo,
      })
      .from(announcementCommentsTable)
      .leftJoin(usersTable, eq(announcementCommentsTable.userId, usersTable.id))
      .where(inArray(announcementCommentsTable.announcementId, announcementIds))
      .orderBy(announcementCommentsTable.createdAt),
    db
      .select({
        announcementId: announcementsTable.id,
        departmentId: announcementChannelDepartmentMembersTable.departmentId,
      })
      .from(announcementsTable)
      .innerJoin(
        announcementChannelDepartmentMembersTable,
        eq(announcementsTable.categoryId, announcementChannelDepartmentMembersTable.channelId),
      )
      .where(inArray(announcementsTable.id, announcementIds)),
    db
      .select({
        announcementId: announcementsTable.id,
        userId: announcementChannelUserMembersTable.userId,
      })
      .from(announcementsTable)
      .innerJoin(
        announcementChannelUserMembersTable,
        eq(announcementsTable.categoryId, announcementChannelUserMembersTable.channelId),
      )
      .where(inArray(announcementsTable.id, announcementIds)),
    db
      .select({
        id: announcementAttachmentsTable.id,
        announcementId: announcementAttachmentsTable.announcementId,
        mediaId: announcementAttachmentsTable.mediaId,
        filename: mediaTable.filename,
        mimeType: mediaTable.mimeType,
        filesize: mediaTable.filesize,
        url: mediaTable.url,
      })
      .from(announcementAttachmentsTable)
      .leftJoin(mediaTable, eq(announcementAttachmentsTable.mediaId, mediaTable.id))
      .where(inArray(announcementAttachmentsTable.announcementId, announcementIds)),
    db
      .select({
        announcementId: announcementMentionsTable.announcementId,
        userId: announcementMentionsTable.userId,
        label: announcementMentionsTable.label,
      })
      .from(announcementMentionsTable)
      .where(inArray(announcementMentionsTable.announcementId, announcementIds)),
  ])

  const commentIds = comments.map((comment) => comment.id)
  const [commentReactions, myCommentReactionsRows, commentAttachments] =
    commentIds.length > 0
      ? await Promise.all([
          db
            .select({
              commentId: announcementCommentReactionsTable.commentId,
              emoji: announcementCommentReactionsTable.emoji,
              cnt: count(),
            })
            .from(announcementCommentReactionsTable)
            .where(inArray(announcementCommentReactionsTable.commentId, commentIds))
            .groupBy(
              announcementCommentReactionsTable.commentId,
              announcementCommentReactionsTable.emoji,
            ),
          db
            .select({
              commentId: announcementCommentReactionsTable.commentId,
              emoji: announcementCommentReactionsTable.emoji,
            })
            .from(announcementCommentReactionsTable)
            .where(
              and(
                inArray(announcementCommentReactionsTable.commentId, commentIds),
                eq(announcementCommentReactionsTable.userId, user.id),
              ),
            ),
          db
            .select({
              id: announcementCommentAttachmentsTable.id,
              commentId: announcementCommentAttachmentsTable.commentId,
              mediaId: announcementCommentAttachmentsTable.mediaId,
              filename: mediaTable.filename,
              mimeType: mediaTable.mimeType,
              filesize: mediaTable.filesize,
              url: mediaTable.url,
            })
            .from(announcementCommentAttachmentsTable)
            .leftJoin(mediaTable, eq(announcementCommentAttachmentsTable.mediaId, mediaTable.id))
            .where(inArray(announcementCommentAttachmentsTable.commentId, commentIds)),
        ])
      : [[], [], []]

  return rows.map((row) => {
    const reactionCounts: Record<string, number> = {}
    reactions
      .filter((r) => r.announcementId === row.id)
      .forEach((r) => {
        reactionCounts[r.emoji] = Number(r.cnt)
      })

    const myReactions = myReactionsRows
      .filter((r) => r.announcementId === row.id)
      .map((r) => r.emoji)

    const commentCountRow = commentCountRows.find((r) => r.announcementId === row.id)
    const commentCount = Number(commentCountRow?.cnt || 0)

    const rowComments: AnnouncementComment[] = comments
      .filter((c) => c.announcementId === row.id)
      .map((c) => {
        const commentReactionCounts: Record<string, number> = {}
        commentReactions
          .filter((reaction) => reaction.commentId === c.id)
          .forEach((reaction) => {
            commentReactionCounts[reaction.emoji] = Number(reaction.cnt)
          })

        const myCommentReactions = myCommentReactionsRows
          .filter((reaction) => reaction.commentId === c.id)
          .map((reaction) => reaction.emoji)
        const rowCommentAttachments: AnnouncementAttachment[] = commentAttachments
          .filter((attachment) => attachment.commentId === c.id && attachment.filename)
          .map((attachment) => ({
            id: attachment.id,
            mediaId: attachment.mediaId,
            filename: attachment.filename || 'Attachment',
            mimeType: attachment.mimeType || 'application/octet-stream',
            filesize: attachment.filesize || 0,
            url: attachment.url || '#',
          }))

        return {
          id: c.id,
          userId: c.userId,
          authorName: c.authorName || 'Unknown',
          authorPhoto: c.authorPhoto ?? null,
          body: c.body,
          createdAt: c.createdAt,
          attachments: rowCommentAttachments,
          reactionCounts: commentReactionCounts,
          myReactions: myCommentReactions,
        }
      })

    const rowAttachments: AnnouncementAttachment[] = attachments
      .filter((attachment) => attachment.announcementId === row.id && attachment.filename)
      .map((attachment) => ({
        id: attachment.id,
        mediaId: attachment.mediaId,
        filename: attachment.filename || 'Attachment',
        mimeType: attachment.mimeType || 'application/octet-stream',
        filesize: attachment.filesize || 0,
        url: attachment.url || '#',
      }))
    const rowMentions: AnnouncementMention[] = mentions
      .filter((mention) => mention.announcementId === row.id)
      .map((mention) => ({
        id: mention.userId,
        label: mention.label,
      }))

    return {
      id: row.id,
      title: row.title,
      body: row.body,
      status: row.status,
      targetType: row.targetType,
      pinned: row.pinned,
      sentAt: row.sentAt,
      createdAt: row.createdAt,
      createdById: row.createdById,
      creatorName: row.creatorName || 'Unknown',
      creatorPhoto: row.creatorPhoto ?? null,
      categoryId: row.categoryId,
      categoryName: row.categoryName ?? null,
      categoryColor: row.categoryColor ?? null,
      channelVisibility: row.channelVisibility ?? null,
      departmentIds: departmentTargets
        .filter((target) => target.announcementId === row.id)
        .map((target) => target.departmentId),
      userIds: userTargets
        .filter((target) => target.announcementId === row.id)
        .map((target) => target.userId),
      attachments: rowAttachments,
      mentions: rowMentions,
      reactionCounts,
      myReactions,
      commentCount,
      comments: rowComments,
    }
  })
}

export async function getPinnedAnnouncements(user: User): Promise<AnnouncementFeedItem[]> {
  const all = await getAnnouncementFeed(user)
  return all.filter((item) => item.pinned)
}
