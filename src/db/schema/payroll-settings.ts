import {
  pgTable,
  text,
  pgEnum,
  boolean,
  json,
  numeric,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { usersTable } from './users'

// ============================================
// Enums
// ============================================

export const payrollTypeEnum = pgEnum('payroll_type', [
  'primary',
  'bonus',
  'overtime',
  'commission',
  'allowance',
  'other',
])

export const paymentMethodEnum = pgEnum('payment_method', ['bankTransfer', 'cash', 'cheque'])

export const paymentFrequencyEnum = pgEnum('payment_frequency', [
  'monthly',
  'quarterly',
  'annual',
  'oneTime',
])

// ============================================
// Payroll Settings Table (Recurring Templates)
// ============================================

export const payrollSettingsTable = pgTable('payroll_settings', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // Employee
  employeeId: text('employee_id').notNull(),

  // Payroll Item Details
  payrollType: payrollTypeEnum('payroll_type').default('primary').notNull(),
  description: text('description'),

  // Payment Details
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  paymentType: paymentMethodEnum('payment_type').default('bankTransfer').notNull(),
  paymentFrequency: paymentFrequencyEnum('payment_frequency').default('monthly').notNull(),

  // Bank Account Details
  bankAccount: json('bank_account').$type<{
    accountNumber?: string
    bankName?: string
    accountHolderName?: string
    swiftCode?: string
  }>(),

  // Status and Timing
  isActive: boolean('is_active').default(true).notNull(),
  startDate: text('start_date').notNull(), // ISO 8601: "YYYY-MM-DD"
  endDate: text('end_date'), // Null = ongoing

  // Notes
  notes: text('notes'),

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

export const payrollSettingsRelations = relations(payrollSettingsTable, ({ one }) => ({
  employee: one(usersTable, {
    fields: [payrollSettingsTable.employeeId],
    references: [usersTable.id],
  }),
}))
