import { index, jsonb, pgTable, text, unique } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { usersTable } from './users'

export type MemberActivityChange = {
  field: string
  label?: string
  oldValue?: unknown
  newValue?: unknown
}

export type MemberActivityMetadata = Record<string, unknown> & {
  changes?: MemberActivityChange[]
  linkUrl?: string
}

export const memberActivityLogsTable = pgTable(
  'member_activity_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    subjectUserId: text('subject_user_id').notNull(),
    actorUserId: text('actor_user_id'),
    eventType: text('event_type').notNull(),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    sourceLabel: text('source_label'),
    metadata: jsonb('metadata').$type<MemberActivityMetadata>().default({}).notNull(),
    sourceKey: text('source_key'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (table) => [
    index('member_activity_logs_subject_created_idx').on(table.subjectUserId, table.createdAt),
    index('member_activity_logs_source_idx').on(table.sourceType, table.sourceId),
    unique('member_activity_logs_source_key_unique').on(table.sourceKey),
  ],
)

export const memberActivityLogsRelations = relations(memberActivityLogsTable, ({ one }) => ({
  subject: one(usersTable, {
    fields: [memberActivityLogsTable.subjectUserId],
    references: [usersTable.id],
    relationName: 'memberActivitySubject',
  }),
  actor: one(usersTable, {
    fields: [memberActivityLogsTable.actorUserId],
    references: [usersTable.id],
    relationName: 'memberActivityActor',
  }),
}))
