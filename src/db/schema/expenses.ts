import { sql } from 'drizzle-orm'
import { boolean, integer, json, numeric, pgEnum, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core'

export const expenseTypeEnum = pgEnum('expense_type', ['oneTime', 'recurring'])

export const expensePaymentSourceEnum = pgEnum('expense_payment_source', ['single', 'recurring'])

export const expenseBillingCycleEnum = pgEnum('expense_billing_cycle', [
  'monthly',
  'quarterly',
  'sixMonthly',
  'yearly',
])

export const expensePaymentStatusEnum = pgEnum('expense_payment_status', [
  'generated',
  'approved',
  'paid',
  'cancelled',
])

export const expensePaymentMethodEnum = pgEnum('expense_payment_method', [
  'bankTransfer',
  'cash',
  'cheque',
  'creditCard',
  'other',
])

export const expensesTable = pgTable('expenses', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  type: expenseTypeEnum('type').default('recurring').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  vendor: varchar('vendor', { length: 255 }),
  paymentMethod: expensePaymentMethodEnum('payment_method').default('bankTransfer').notNull(),
  isReimbursable: boolean('is_reimbursable').default(false).notNull(),
  reimbursableEmployeeId: text('reimbursable_employee_id'),
  notes: text('notes'),

  billingCycle: expenseBillingCycleEnum('billing_cycle'),
  recurringDay: integer('recurring_day'),
  recurringMonth: integer('recurring_month'),
  dueOffsetDays: integer('due_offset_days').default(7).notNull(),
  startDate: text('start_date'),
  isActive: boolean('is_active').default(true).notNull(),

  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

export const expensePaymentsTable = pgTable(
  'expense_payments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    expenseId: text('expense_id'),
    type: expenseTypeEnum('type').notNull(),
    source: expensePaymentSourceEnum('source').default('single').notNull(),
    status: expensePaymentStatusEnum('status').default('generated').notNull(),

    expenseMonth: varchar('expense_month', { length: 2 }).notNull(),
    expenseYear: integer('expense_year').notNull(),
    generationDate: text('generation_date').notNull(),
    dueDate: text('due_date').notNull(),
    paymentDate: text('payment_date'),

    name: varchar('name', { length: 255 }).notNull(),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    category: varchar('category', { length: 100 }).notNull(),
    vendor: varchar('vendor', { length: 255 }),
    paymentMethod: expensePaymentMethodEnum('payment_method').default('bankTransfer').notNull(),
    isReimbursable: boolean('is_reimbursable').default(false).notNull(),
    reimbursableEmployeeId: text('reimbursable_employee_id'),
    notes: text('notes'),
    documents: json('documents').$type<string[]>().default([]),

    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (table) => ({
    recurringPeriodUnique: uniqueIndex('expense_payments_recurring_period_unique')
      .on(table.expenseId, table.expenseMonth, table.expenseYear)
      .where(sql`${table.expenseId} IS NOT NULL`),
  }),
)
