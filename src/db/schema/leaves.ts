import { pgTable, text, pgEnum, integer, boolean, varchar, json } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { usersTable } from './users'

// ============================================
// Enums
// ============================================

export const leaveTypeEnum = pgEnum('leave_type', ['annual', 'sick', 'unpaid', 'other'])

export const leaveStatusEnum = pgEnum('leave_status', [
  'requested',
  'approved',
  'rejected',
  'cancelled',
])

// ============================================
// Leaves Table
// ============================================

export const leavesTable = pgTable('leave_days', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // User (who is taking leave)
  userId: text('user_id').notNull(),

  // Leave Information
  type: leaveTypeEnum('type').notNull(),
  startDate: text('start_date').notNull(), // ISO 8601: "YYYY-MM-DD"
  endDate: text('end_date').notNull(), // ISO 8601: "YYYY-MM-DD"
  totalDays: integer('total_days'), // Charged/deducted days
  autoCalculatedDays: integer('auto_calculated_days'),
  isManualDayCount: boolean('is_manual_day_count').default(false).notNull(),
  manualDayCountReason: text('manual_day_count_reason'),

  // Status & Approval
  status: leaveStatusEnum('status').default('requested').notNull(),

  // Details
  reason: text('reason').notNull(),
  note: text('note'), // Additional notes/comments
  attachments: json('attachments').$type<string[]>().default([]).notNull(),

  // Timestamps
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

export const leavesRelations = relations(leavesTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [leavesTable.userId],
    references: [usersTable.id],
  }),
}))

export const leavePolicySettingsTable = pgTable('leave_policy_settings', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  carryoverLimitDays: integer('carryover_limit_days'),
  countSaturday: boolean('count_saturday').default(true).notNull(),
  countSunday: boolean('count_sunday').default(false).notNull(),
  countHolidays: boolean('count_holidays').default(true).notNull(),
  allowNegativeBalance: boolean('allow_negative_balance').default(true).notNull(),
  unpaidLeaveDeductionEnabled: boolean('unpaid_leave_deduction_enabled').default(true).notNull(),
  unpaidLeaveDeductionDailyRateBasis: varchar('unpaid_leave_deduction_daily_rate_basis', {
    length: 32,
  })
    .default('workingDays')
    .notNull(),
  unpaidLeaveDeductionDayBasis: varchar('unpaid_leave_deduction_day_basis', { length: 32 })
    .default('leavePolicy')
    .notNull(),

  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

export const leaveEntitlementTiersTable = pgTable('leave_entitlement_tiers', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  minimumServiceMonths: integer('minimum_service_months').notNull(),
  days: integer('days').notNull(),
  label: varchar('label', { length: 255 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),

  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})
