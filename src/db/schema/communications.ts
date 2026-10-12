import { boolean, index, integer, jsonb, pgEnum, pgTable, text, unique, varchar } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { departmentsTable } from './departments'
import { mediaTable } from './media'
import { usersTable } from './users'

export const targetTypeEnum = pgEnum('communication_target_type', [
  'everyone',
  'departments',
  'users',
])

export const announcementStatusEnum = pgEnum('announcement_status', ['draft', 'sent', 'archived'])

export const eventStatusEnum = pgEnum('event_status', [
  'draft',
  'published',
  'new',
  'held',
  'cancelled',
])

export const notificationSourceTypeEnum = pgEnum('notification_source_type', [
  'announcement',
  'event',
])

export const notificationEmailStatusEnum = pgEnum('notification_email_status', [
  'pending',
  'sent',
  'failed',
  'skipped',
])

export const announcementChannelVisibilityEnum = pgEnum('announcement_channel_visibility', [
  'public',
  'private',
])

export const notificationOutboxStatusEnum = pgEnum('notification_outbox_status', [
  'pending',
  'processed',
  'failed',
])

export const announcementCategoriesTable = pgTable('announcement_categories', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 7 }).notNull().default('#6366f1'),
  visibility: announcementChannelVisibilityEnum('visibility').default('public').notNull(),
  createdById: text('created_by_id'),
  notifyInApp: boolean('notify_in_app').default(true).notNull(),
  notifyEmail: boolean('notify_email').default(false).notNull(),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

export const announcementsTable = pgTable('announcements', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  status: announcementStatusEnum('status').default('draft').notNull(),
  targetType: targetTypeEnum('target_type').default('everyone').notNull(),
  createdById: text('created_by_id').notNull(),
  categoryId: text('category_id'),
  pinned: boolean('pinned').default(false).notNull(),
  eventId: text('event_id'),
  sentAt: text('sent_at'),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

export const eventsTable = pgTable('events', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: eventStatusEnum('status').default('new').notNull(),
  targetType: targetTypeEnum('target_type').default('everyone').notNull(),
  startAt: text('start_at').notNull(),
  endAt: text('end_at').notNull(),
  allDay: boolean('all_day').default(false).notNull(),
  timezone: varchar('timezone', { length: 100 }).default('UTC').notNull(),
  location: varchar('location', { length: 255 }),
  createdById: text('created_by_id').notNull(),
  announcementId: text('announcement_id'),
  notifyInApp: boolean('notify_in_app').default(true).notNull(),
  notifyEmail: boolean('notify_email').default(false).notNull(),
  publishedAt: text('published_at'),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

export const announcementDepartmentTargetsTable = pgTable('announcement_department_targets', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  announcementId: text('announcement_id').notNull(),
  departmentId: text('department_id').notNull(),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

export const announcementUserTargetsTable = pgTable('announcement_user_targets', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  announcementId: text('announcement_id').notNull(),
  userId: text('user_id').notNull(),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

export const announcementReactionsTable = pgTable(
  'announcement_reactions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    announcementId: text('announcement_id').notNull(),
    userId: text('user_id').notNull(),
    emoji: varchar('emoji', { length: 10 }).notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (table) => [unique().on(table.announcementId, table.userId, table.emoji)],
)

export const announcementCommentsTable = pgTable('announcement_comments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  announcementId: text('announcement_id').notNull(),
  userId: text('user_id').notNull(),
  body: text('body').notNull(),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

export const announcementCommentReactionsTable = pgTable(
  'announcement_comment_reactions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    commentId: text('comment_id').notNull(),
    userId: text('user_id').notNull(),
    emoji: varchar('emoji', { length: 10 }).notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (table) => [unique().on(table.commentId, table.userId, table.emoji)],
)

export const announcementCommentAttachmentsTable = pgTable('announcement_comment_attachments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  commentId: text('comment_id').notNull(),
  mediaId: text('media_id').notNull(),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

export const announcementAttachmentsTable = pgTable('announcement_attachments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  announcementId: text('announcement_id').notNull(),
  mediaId: text('media_id').notNull(),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

export const announcementMentionsTable = pgTable(
  'announcement_mentions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    announcementId: text('announcement_id').notNull(),
    userId: text('user_id').notNull(),
    label: varchar('label', { length: 255 }).notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (table) => [
    unique('announcement_mentions_announcement_user_unique').on(
      table.announcementId,
      table.userId,
    ),
    index('announcement_mentions_announcement_idx').on(table.announcementId),
  ],
)

export const eventDepartmentTargetsTable = pgTable('event_department_targets', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  eventId: text('event_id').notNull(),
  departmentId: text('department_id').notNull(),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

export const eventUserTargetsTable = pgTable('event_user_targets', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  eventId: text('event_id').notNull(),
  userId: text('user_id').notNull(),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

export const announcementChannelDepartmentMembersTable = pgTable('announcement_channel_department_members', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  channelId: text('channel_id').notNull(),
  departmentId: text('department_id').notNull(),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

export const announcementChannelUserMembersTable = pgTable('announcement_channel_user_members', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  channelId: text('channel_id').notNull(),
  userId: text('user_id').notNull(),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

export const notificationsTable = pgTable('notifications', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  recipientUserId: text('recipient_user_id').notNull(),
  eventType: varchar('event_type', { length: 120 }).default('legacy.notification').notNull(),
  sourceType: text('source_type').notNull(),
  sourceId: text('source_id').notNull(),
  actorUserId: text('actor_user_id'),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  linkUrl: text('link_url').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  readAt: text('read_at'),
  seenAt: text('seen_at'),
  archivedAt: text('archived_at'),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

export type NotificationOutboxRecipient = {
  id: string
  email?: string | null
  fullName?: string | null
}

export type NotificationOutboxDelivery = {
  inApp: boolean
  email: boolean
}

export type NotificationOutboxPayload = Record<string, unknown>

export const notificationEventOutboxTable = pgTable(
  'notification_event_outbox',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventType: varchar('event_type', { length: 120 }).notNull(),
    sourceType: varchar('source_type', { length: 80 }).notNull(),
    sourceId: text('source_id').notNull(),
    sourceKey: text('source_key').notNull(),
    actorUserId: text('actor_user_id'),
    recipients: jsonb('recipients').$type<NotificationOutboxRecipient[]>().notNull(),
    payload: jsonb('payload').$type<NotificationOutboxPayload>().notNull(),
    delivery: jsonb('delivery').$type<NotificationOutboxDelivery>().notNull(),
    status: notificationOutboxStatusEnum('status').default('pending').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    lastError: text('last_error'),
    nextAttemptAt: text('next_attempt_at'),
    processedAt: text('processed_at'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (table) => [
    unique('notification_event_outbox_source_key_unique').on(table.sourceKey),
    index('notification_event_outbox_dispatch_idx').on(table.status, table.nextAttemptAt),
    index('notification_event_outbox_source_idx').on(table.sourceType, table.sourceId),
  ],
)

export const notificationEmailDeliveriesTable = pgTable('notification_email_deliveries', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  notificationId: text('notification_id').notNull(),
  recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
  status: notificationEmailStatusEnum('status').default('pending').notNull(),
  sentAt: text('sent_at'),
  error: text('error'),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

export const announcementsRelations = relations(announcementsTable, ({ one, many }) => ({
  createdBy: one(usersTable, {
    fields: [announcementsTable.createdById],
    references: [usersTable.id],
  }),
  category: one(announcementCategoriesTable, {
    fields: [announcementsTable.categoryId],
    references: [announcementCategoriesTable.id],
  }),
  event: one(eventsTable, {
    fields: [announcementsTable.eventId],
    references: [eventsTable.id],
  }),
  departmentTargets: many(announcementDepartmentTargetsTable),
  userTargets: many(announcementUserTargetsTable),
  reactions: many(announcementReactionsTable),
  comments: many(announcementCommentsTable),
  attachments: many(announcementAttachmentsTable),
  mentions: many(announcementMentionsTable),
  departmentMembers: many(announcementChannelDepartmentMembersTable),
  userMembers: many(announcementChannelUserMembersTable),
}))

export const announcementCommentsRelations = relations(
  announcementCommentsTable,
  ({ one, many }) => ({
    announcement: one(announcementsTable, {
      fields: [announcementCommentsTable.announcementId],
      references: [announcementsTable.id],
    }),
    user: one(usersTable, {
      fields: [announcementCommentsTable.userId],
      references: [usersTable.id],
    }),
    reactions: many(announcementCommentReactionsTable),
    attachments: many(announcementCommentAttachmentsTable),
  }),
)

export const announcementCommentReactionsRelations = relations(
  announcementCommentReactionsTable,
  ({ one }) => ({
    comment: one(announcementCommentsTable, {
      fields: [announcementCommentReactionsTable.commentId],
      references: [announcementCommentsTable.id],
    }),
    user: one(usersTable, {
      fields: [announcementCommentReactionsTable.userId],
      references: [usersTable.id],
    }),
  }),
)

export const announcementCommentAttachmentsRelations = relations(
  announcementCommentAttachmentsTable,
  ({ one }) => ({
    comment: one(announcementCommentsTable, {
      fields: [announcementCommentAttachmentsTable.commentId],
      references: [announcementCommentsTable.id],
    }),
    media: one(mediaTable, {
      fields: [announcementCommentAttachmentsTable.mediaId],
      references: [mediaTable.id],
    }),
  }),
)

export const announcementAttachmentsRelations = relations(
  announcementAttachmentsTable,
  ({ one }) => ({
    announcement: one(announcementsTable, {
      fields: [announcementAttachmentsTable.announcementId],
      references: [announcementsTable.id],
    }),
    media: one(mediaTable, {
      fields: [announcementAttachmentsTable.mediaId],
      references: [mediaTable.id],
    }),
  }),
)

export const announcementMentionsRelations = relations(announcementMentionsTable, ({ one }) => ({
  announcement: one(announcementsTable, {
    fields: [announcementMentionsTable.announcementId],
    references: [announcementsTable.id],
  }),
  user: one(usersTable, {
    fields: [announcementMentionsTable.userId],
    references: [usersTable.id],
  }),
}))

export const announcementCategoriesRelations = relations(
  announcementCategoriesTable,
  ({ many }) => ({
    announcements: many(announcementsTable),
    departmentMembers: many(announcementChannelDepartmentMembersTable),
    userMembers: many(announcementChannelUserMembersTable),
  }),
)

export const announcementChannelDepartmentMembersRelations = relations(
  announcementChannelDepartmentMembersTable,
  ({ one }) => ({
    channel: one(announcementCategoriesTable, {
      fields: [announcementChannelDepartmentMembersTable.channelId],
      references: [announcementCategoriesTable.id],
    }),
    department: one(departmentsTable, {
      fields: [announcementChannelDepartmentMembersTable.departmentId],
      references: [departmentsTable.id],
    }),
  }),
)

export const announcementChannelUserMembersRelations = relations(
  announcementChannelUserMembersTable,
  ({ one }) => ({
    channel: one(announcementCategoriesTable, {
      fields: [announcementChannelUserMembersTable.channelId],
      references: [announcementCategoriesTable.id],
    }),
    user: one(usersTable, {
      fields: [announcementChannelUserMembersTable.userId],
      references: [usersTable.id],
    }),
  }),
)

export const eventsRelations = relations(eventsTable, ({ one, many }) => ({
  createdBy: one(usersTable, {
    fields: [eventsTable.createdById],
    references: [usersTable.id],
  }),
  announcement: one(announcementsTable, {
    fields: [eventsTable.announcementId],
    references: [announcementsTable.id],
  }),
  departmentTargets: many(eventDepartmentTargetsTable),
  userTargets: many(eventUserTargetsTable),
}))

export const announcementDepartmentTargetsRelations = relations(
  announcementDepartmentTargetsTable,
  ({ one }) => ({
    announcement: one(announcementsTable, {
      fields: [announcementDepartmentTargetsTable.announcementId],
      references: [announcementsTable.id],
    }),
    department: one(departmentsTable, {
      fields: [announcementDepartmentTargetsTable.departmentId],
      references: [departmentsTable.id],
    }),
  }),
)

export const announcementUserTargetsRelations = relations(
  announcementUserTargetsTable,
  ({ one }) => ({
    announcement: one(announcementsTable, {
      fields: [announcementUserTargetsTable.announcementId],
      references: [announcementsTable.id],
    }),
    user: one(usersTable, {
      fields: [announcementUserTargetsTable.userId],
      references: [usersTable.id],
    }),
  }),
)

export const eventDepartmentTargetsRelations = relations(
  eventDepartmentTargetsTable,
  ({ one }) => ({
    event: one(eventsTable, {
      fields: [eventDepartmentTargetsTable.eventId],
      references: [eventsTable.id],
    }),
    department: one(departmentsTable, {
      fields: [eventDepartmentTargetsTable.departmentId],
      references: [departmentsTable.id],
    }),
  }),
)

export const eventUserTargetsRelations = relations(eventUserTargetsTable, ({ one }) => ({
  event: one(eventsTable, {
    fields: [eventUserTargetsTable.eventId],
    references: [eventsTable.id],
  }),
  user: one(usersTable, {
    fields: [eventUserTargetsTable.userId],
    references: [usersTable.id],
  }),
}))

export const notificationsRelations = relations(notificationsTable, ({ one, many }) => ({
  recipient: one(usersTable, {
    fields: [notificationsTable.recipientUserId],
    references: [usersTable.id],
  }),
  emailDeliveries: many(notificationEmailDeliveriesTable),
}))

export const notificationEmailDeliveriesRelations = relations(
  notificationEmailDeliveriesTable,
  ({ one }) => ({
    notification: one(notificationsTable, {
      fields: [notificationEmailDeliveriesTable.notificationId],
      references: [notificationsTable.id],
    }),
  }),
)
