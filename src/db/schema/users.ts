import { pgTable, text, varchar, boolean, pgEnum, json, unique } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { rolesTable } from './roles'
import { departmentsTable } from './departments'
import { accountsTable, sessionsTable } from './auth'

// ============================================
// Enums
// ============================================

export const employmentTypeEnum = pgEnum('employment_type', ['citizen', 'workPermit', 'other'])

export const personTypeEnum = pgEnum('person_type', [
  'employee',
  'contractor',
  'consultant',
  'external',
  'serviceAccount',
])

// ============================================
// User Table (NextAuth + Custom Fields)
// ============================================

export const usersTable = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // Auth fields
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 255 }).unique(),
  password: text('password'),
  emailVerified: text('email_verified'), // ISO 8601: "YYYY-MM-DDTHH:mm:ss.sssZ"

  // Personal Information
  fullName: varchar('full_name', { length: 255 }).notNull(),
  photo: text('photo'), // URL to media file
  birthDate: text('birth_date'), // ISO 8601: "YYYY-MM-DD"

  // Contact Information
  primaryPhone: varchar('primary_phone', { length: 50 }),
  secondaryPhone: varchar('secondary_phone', { length: 50 }),
  secondaryEmail: varchar('secondary_email', { length: 255 }).unique(),
  address: text('address'),

  // Employment Information
  jobTitle: varchar('job_title', { length: 255 }),
  employmentType: employmentTypeEnum('employment_type').default('other').notNull(),
  nationality: varchar('nationality', { length: 100 }),
  identityNumber: varchar('identity_number', { length: 100 }),
  employmentStartDate: text('employment_start_date'), // ISO 8601: "YYYY-MM-DD"
  employmentNote: text('employment_note'),

  // Status
  isActive: boolean('is_active').default(true).notNull(),
  isProtectedAdmin: boolean('is_protected_admin').default(false).notNull(),
  personType: personTypeEnum('person_type').default('employee').notNull(),
  includeInHeadcount: boolean('include_in_headcount').default(true).notNull(),
  visibleInTeamDirectory: boolean('visible_in_team_directory').default(true).notNull(),

  // Preferences
  language: text('language').default('en').notNull(),
  theme: text('theme').default('light').notNull(),

  // Relations
  roleId: text('role_id'),
  departmentId: text('department_id'),
  documents: json('documents').$type<string[]>().default([]), // Array of media URLs

  // Timestamps
  joinedAt: text('joined_at'), // ISO 8601: "YYYY-MM-DD"
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

export const userDottedManagersTable = pgTable(
  'user_dotted_managers',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull(),
    managerId: text('manager_id').notNull(),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (table) => ({
    userManagerUnique: unique('user_dotted_managers_user_manager_unique').on(
      table.userId,
      table.managerId,
    ),
  }),
)

// ============================================
// Relations
// ============================================

export const usersRelations = relations(usersTable, ({ one, many }) => ({
  role: one(rolesTable, {
    fields: [usersTable.roleId],
    references: [rolesTable.id],
  }),
  department: one(departmentsTable, {
    fields: [usersTable.departmentId],
    references: [departmentsTable.id],
    relationName: 'departmentUsers',
  }),
  dottedManagers: many(userDottedManagersTable, {
    relationName: 'dottedManagersForUser',
  }),
  dottedReports: many(userDottedManagersTable, {
    relationName: 'dottedReportsForManager',
  }),
  managedDepartments: many(departmentsTable, {
    relationName: 'managedDepartmentManager',
  }),
  accounts: many(accountsTable),
  sessions: many(sessionsTable),
}))

export const userDottedManagersRelations = relations(userDottedManagersTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [userDottedManagersTable.userId],
    references: [usersTable.id],
    relationName: 'dottedManagersForUser',
  }),
  manager: one(usersTable, {
    fields: [userDottedManagersTable.managerId],
    references: [usersTable.id],
    relationName: 'dottedReportsForManager',
  }),
}))
