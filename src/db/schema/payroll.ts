import { pgTable, text, varchar, integer, pgEnum, json, numeric } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { usersTable } from './users'
import { paymentMethodEnum } from './payroll-settings'

// ============================================
// Enums
// ============================================

export const payrollStatusEnum = pgEnum('payroll_status', [
  'generated',
  'approved',
  'paid',
  'cancelled',
])

export const additionalPaymentCategoryEnum = pgEnum('additional_payment_category', [
  'bonus',
  'advance',
  'commission',
  'allowance',
  'other',
])

// ============================================
// Payroll Table (Monthly Records)
// ============================================

export const payrollTable = pgTable('payroll', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // Employee
  employeeId: text('employee_id').notNull(),

  // Period
  month: varchar('month', { length: 2 }).notNull(), // '01' to '12'
  year: integer('year').notNull(),

  // Payroll Items (from PayrollSettings)
  payrollItems: json('payroll_items')
    .$type<
      Array<{
        payrollSettingId: string
        description: string
        payrollType: 'primary' | 'bonus' | 'overtime' | 'commission' | 'allowance' | 'other'
        amount: number
        paymentType: 'bankTransfer' | 'cash' | 'cheque'
      }>
    >()
    .default([]),

  // Manual Adjustments
  bonusAmount: numeric('bonus_amount', { precision: 10, scale: 2 }).default('0'),
  deductionAmount: numeric('deduction_amount', { precision: 10, scale: 2 }).default('0'),
  adjustmentNote: text('adjustment_note'),

  // Calculated Total
  totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),

  // Payment Tracking
  paymentDate: text('payment_date'), // ISO 8601: "YYYY-MM-DD"
  paymentReference: text('payment_reference'),
  paymentNotes: text('payment_notes'),

  // Status
  status: payrollStatusEnum('status').default('generated').notNull(),

  // Processing Info
  processedById: text('processed_by_id'),
  processedAt: text('processed_at'), // ISO 8601

  // Timestamps
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

// ============================================
// Additional Payments Table (One-off Payments)
// ============================================

export const additionalPaymentsTable = pgTable('additional_payments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  employeeId: text('employee_id').notNull(),
  category: additionalPaymentCategoryEnum('category').default('bonus').notNull(),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  paymentType: paymentMethodEnum('payment_type').default('bankTransfer').notNull(),
  month: varchar('month', { length: 2 }).notNull(),
  year: integer('year').notNull(),
  status: payrollStatusEnum('status').default('generated').notNull(),
  notes: text('notes'),
  paymentDate: text('payment_date'), // ISO 8601: "YYYY-MM-DD"

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

export const payrollRelations = relations(payrollTable, ({ one }) => ({
  employee: one(usersTable, {
    fields: [payrollTable.employeeId],
    references: [usersTable.id],
  }),
  processedBy: one(usersTable, {
    fields: [payrollTable.processedById],
    references: [usersTable.id],
  }),
}))

export const additionalPaymentsRelations = relations(additionalPaymentsTable, ({ one }) => ({
  employee: one(usersTable, {
    fields: [additionalPaymentsTable.employeeId],
    references: [usersTable.id],
  }),
}))
