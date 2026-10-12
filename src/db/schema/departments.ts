import { pgTable, text, varchar, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { usersTable } from './users'

// ============================================
// Department Table (Stage 1: Simple Categories)
// ============================================

export const departmentsTable = pgTable('departments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar('name', { length: 100 }).notNull().unique(),
  parentDepartmentId: text('parent_department_id'),
  managerUserId: text('manager_user_id'),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

// ============================================
// Relations
// ============================================

export const departmentsRelations = relations(departmentsTable, ({ many, one }) => ({
  parentDepartment: one(departmentsTable, {
    fields: [departmentsTable.parentDepartmentId],
    references: [departmentsTable.id],
    relationName: 'departmentChildren',
  }),
  childDepartments: many(departmentsTable, {
    relationName: 'departmentChildren',
  }),
  manager: one(usersTable, {
    fields: [departmentsTable.managerUserId],
    references: [usersTable.id],
    relationName: 'managedDepartmentManager',
  }),
  users: many(usersTable, {
    relationName: 'departmentUsers',
  }),
}))
