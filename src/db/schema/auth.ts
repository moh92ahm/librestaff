import { pgTable, text  } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { usersTable } from './users'

// ============================================
// NextAuth Tables
// ============================================

export const accountsTable = pgTable('accounts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: text('expires_at'), // ISO 8601
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
})

export const sessionsTable = pgTable('sessions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sessionToken: text('session_token').notNull().unique(),
  userId: text('user_id').notNull(),
  expires: text('expires').notNull(), // ISO 8601
})

export const verificationTokensTable = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull().unique(),
  expires: text('expires').notNull(), // ISO 8601
})

// ============================================
// Relations
// ============================================

export const accountsRelations = relations(accountsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [accountsTable.userId],
    references: [usersTable.id],
  }),
}))

export const sessionsRelations = relations(sessionsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [sessionsTable.userId],
    references: [usersTable.id],
  }),
}))
