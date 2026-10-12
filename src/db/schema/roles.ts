import { boolean, pgTable, text, unique, varchar } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { usersTable } from './users'

// ============================================
// Role Table: access roles only. Manager status is derived from department_managers.
// ============================================

export const rolesTable = pgTable('roles', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar('name', { length: 50 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  description: text('description'),
  isSystem: boolean('is_system').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

export const rolePermissionsTable = pgTable(
  'role_permissions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    roleId: text('role_id').notNull(),
    resource: varchar('resource', { length: 50 }).notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    scope: varchar('scope', { length: 50 }).notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (table) => [unique('role_permissions_role_resource_action_unique').on(table.roleId, table.resource, table.action)],
)

// ============================================
// Relations
// ============================================

export const rolesRelations = relations(rolesTable, ({ many }) => ({
  users: many(usersTable),
  permissions: many(rolePermissionsTable),
}))

export const rolePermissionsRelations = relations(rolePermissionsTable, ({ one }) => ({
  role: one(rolesTable, {
    fields: [rolePermissionsTable.roleId],
    references: [rolesTable.id],
  }),
}))
