import { index, pgTable, text, varchar } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { rolesTable } from './roles'
import { usersTable } from './users'

export const userInvitesTable = pgTable(
  'user_invites',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: varchar('email', { length: 255 }).notNull(),
    roleId: text('role_id').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: text('expires_at').notNull(),
    usedAt: text('used_at'),
    invitedBy: text('invited_by').notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (table) => [index('user_invites_email_idx').on(table.email)],
)

export const userInvitesRelations = relations(userInvitesTable, ({ one }) => ({
  role: one(rolesTable, {
    fields: [userInvitesTable.roleId],
    references: [rolesTable.id],
  }),
  inviter: one(usersTable, {
    fields: [userInvitesTable.invitedBy],
    references: [usersTable.id],
  }),
}))
