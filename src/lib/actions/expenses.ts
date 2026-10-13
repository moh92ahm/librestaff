'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { expensePaymentsTable, expensesTable, usersTable } from '@/db/schema'
import { requireAuth } from '@/lib/auth-guards'
import { requirePermission } from '@/lib/permissions'
import {
  calculateExpenseReportMonth,
  getCompletedMonthKeys,
  getExpenseGenerationDate,
  type ExpenseBillingCycle,
  type ExpensePaymentSource,
  type ExpensePaymentStatus,
} from '@/lib/expenses'
import { generateExpensePaymentsForMonth } from '@/lib/expense-generation'
import { getExpenseReportPayrollRows } from '@/lib/expense-report-data'
import { documentMimeTypes, imageMimeTypes, saveUploadedMedia } from '@/lib/media-storage'
import {
  emitNotificationEvent,
  getFullAccessRecipientsForNotifications,
  NOTIFICATION_EVENTS,
  toNotificationRecipients,
} from '@/lib/notification-events'

type PaymentMethod = 'bankTransfer' | 'cash' | 'cheque' | 'creditCard' | 'other'

const VALID_PAYMENT_STATUSES = new Set(['generated', 'approved', 'paid', 'cancelled'])

function clean(value: FormDataEntryValue | null) {
  return String(value || '').trim()
}

function normalizeDate(value: string) {
  return value ? value.split('T')[0] : null
}

function normalizeInteger(value: string) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function getReimbursableValues(formData: FormData) {
  const isReimbursable =
    formData.get('isReimbursable') === 'on' || formData.get('isReimbursable') === 'true'
  return {
    isReimbursable,
    reimbursableEmployeeId: isReimbursable
      ? clean(formData.get('reimbursableEmployeeId')) || null
      : null,
  }
}

function uniqueIds(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function indexedFormValues(formData: FormData, name: string) {
  return Array.from(formData.entries())
    .filter(([key]) => key === name || key.startsWith(`${name}[`))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value)
}

async function resolveExpenseDocumentIds(formData: FormData) {
  const values = indexedFormValues(formData, 'documents')
  const documentIds: string[] = []

  for (const value of values) {
    if (value instanceof File && value.size > 0) {
      const media = await saveUploadedMedia({
        file: value,
        category: 'expense-documents',
        allowedMimeTypes: [...imageMimeTypes, ...documentMimeTypes],
        alt: value.name,
      })
      documentIds.push(media.id)
      continue
    }

    const id = clean(value)
    if (id) documentIds.push(id)
  }

  return uniqueIds(documentIds)
}

function getRecurringExpenseValues(formData: FormData) {
  const billingCycle = clean(formData.get('billingCycle')) as ExpenseBillingCycle
  const amount = Number(clean(formData.get('amount')) || 0)
  const startDate = normalizeDate(clean(formData.get('startDate')))
  const dueOffsetDays = normalizeInteger(clean(formData.get('dueOffsetDays'))) || 7

  return {
    type: 'recurring' as const,
    name: clean(formData.get('name')),
    amount: String(amount),
    category: clean(formData.get('category')) || 'other',
    vendor: clean(formData.get('vendor')) || null,
    paymentMethod: (clean(formData.get('paymentMethod')) || 'bankTransfer') as PaymentMethod,
    notes: clean(formData.get('notes')) || null,
    billingCycle: billingCycle || 'monthly',
    recurringDay: startDate ? Number(startDate.slice(8, 10)) : 1,
    recurringMonth: null,
    dueOffsetDays,
    startDate,
    isActive: formData.get('isActive') === 'on' || formData.get('isActive') === 'true',
    ...getReimbursableValues(formData),
  }
}

async function getSinglePaymentValues(formData: FormData) {
  const amount = Number(clean(formData.get('amount')) || 0)
  const generationDate =
    normalizeDate(clean(formData.get('generationDate'))) || new Date().toISOString().slice(0, 10)
  const dueDate = generationDate
  const [year, month] = generationDate.split('-')

  return {
    expenseId: null,
    type: 'oneTime' as const,
    source: 'single' as const,
    status: 'generated' as const,
    expenseMonth: month,
    expenseYear: Number(year),
    generationDate,
    dueDate,
    paymentDate: null,
    name: clean(formData.get('name')),
    amount: String(amount),
    category: clean(formData.get('category')) || 'other',
    vendor: clean(formData.get('vendor')) || null,
    paymentMethod: (clean(formData.get('paymentMethod')) || 'bankTransfer') as PaymentMethod,
    notes: clean(formData.get('notes')) || null,
    documents: await resolveExpenseDocumentIds(formData),
    ...getReimbursableValues(formData),
  }
}

async function getExpensePaymentUpdateValues(
  formData: FormData,
  existing: typeof expensePaymentsTable.$inferSelect,
) {
  const amount = Number(clean(formData.get('amount')) || 0)
  const generationDate =
    normalizeDate(clean(formData.get('generationDate'))) || existing.generationDate
  const [year, month] = generationDate.split('-')
  const dueDate =
    existing.source === 'recurring'
      ? normalizeDate(clean(formData.get('dueDate'))) || existing.dueDate
      : existing.dueDate

  return {
    expenseMonth: month,
    expenseYear: Number(year),
    generationDate,
    dueDate,
    name: clean(formData.get('name')),
    amount: String(amount),
    category: clean(formData.get('category')) || 'other',
    vendor: clean(formData.get('vendor')) || null,
    paymentMethod: (clean(formData.get('paymentMethod')) || 'bankTransfer') as PaymentMethod,
    notes: clean(formData.get('notes')) || null,
    documents:
      existing.source === 'single' ? await resolveExpenseDocumentIds(formData) : existing.documents,
    ...getReimbursableValues(formData),
    updatedAt: new Date().toISOString(),
  }
}

function revalidateExpensePaths() {
  revalidatePath('/expenses')
  revalidatePath('/reports/expenses')
  revalidatePath('/')
}

export async function createExpenseAction(formData: FormData) {
  const actor = await requirePermission('expenses', 'create')
  const source = clean(formData.get('source')) as ExpensePaymentSource

  if (source === 'single') {
    const [created] = await db
      .insert(expensePaymentsTable)
      .values(await getSinglePaymentValues(formData))
      .returning()

    await emitNotificationEvent({
      eventType: NOTIFICATION_EVENTS.expenseCreated,
      sourceType: 'expense_payment',
      sourceId: created.id,
      actorUserId: actor.id,
      recipients: toNotificationRecipients(await getFullAccessRecipientsForNotifications()),
      payload: {
        expensePaymentId: created.id,
        name: created.name,
        category: created.category,
        amount: created.amount,
        type: created.source,
        linkUrl: '/expenses',
      },
    })

    revalidateExpensePaths()
    return
  }

  const values = getRecurringExpenseValues(formData)
  const [created] = await db.insert(expensesTable).values(values).returning()

  await emitNotificationEvent({
    eventType: NOTIFICATION_EVENTS.expenseCreated,
    sourceType: 'expense',
    sourceId: created.id,
    actorUserId: actor.id,
    recipients: toNotificationRecipients(await getFullAccessRecipientsForNotifications()),
    payload: {
      expenseId: created.id,
      name: created.name,
      category: created.category,
      amount: created.amount,
      type: created.type,
      linkUrl: '/expenses',
    },
  })

  revalidateExpensePaths()
}

export async function updateExpenseAction(formData: FormData) {
  const actor = await requirePermission('expenses', 'edit')

  const id = clean(formData.get('id'))
  if (!id) throw new Error('Expense ID is required')

  const [updated] = await db
    .update(expensesTable)
    .set({
      ...getRecurringExpenseValues(formData),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(expensesTable.id, id))
    .returning()

  await emitNotificationEvent({
    eventType: NOTIFICATION_EVENTS.expenseUpdated,
    sourceType: 'expense',
    sourceId: updated.id,
    sourceKey: `${NOTIFICATION_EVENTS.expenseUpdated}:expense:${updated.id}:${Date.now()}`,
    actorUserId: actor.id,
    recipients: toNotificationRecipients(await getFullAccessRecipientsForNotifications()),
    payload: {
      expenseId: updated.id,
      name: updated.name,
      category: updated.category,
      amount: updated.amount,
      type: updated.type,
      generationDate: updated.startDate
        ? getExpenseGenerationDate(updated as any, updated.startDate.slice(0, 7))
        : null,
      linkUrl: '/expenses',
    },
  })

  revalidateExpensePaths()
}

export async function deleteExpenseAction(formData: FormData) {
  await requirePermission('expenses', 'delete')

  const id = clean(formData.get('id'))
  if (!id) throw new Error('Expense ID is required')

  await db.delete(expensesTable).where(eq(expensesTable.id, id))

  revalidateExpensePaths()
}

export async function generateExpensePaymentsAction(formData: FormData) {
  await requirePermission('expenses', 'create')

  const month = clean(formData.get('month'))
  const year = normalizeInteger(clean(formData.get('year')))
  if (!month || !year) throw new Error('Month and year are required')

  await generateExpensePaymentsForMonth(`${year}-${month.padStart(2, '0')}`)
  revalidateExpensePaths()
}

export async function updateExpensePaymentStatusAction(formData: FormData) {
  await requirePermission('expenses', 'approve')

  const id = clean(formData.get('id'))
  const status = clean(formData.get('status')) as ExpensePaymentStatus
  if (!id) throw new Error('Payment ID is required')
  if (!VALID_PAYMENT_STATUSES.has(status)) throw new Error('Invalid payment status')

  const existing = await db.query.expensePaymentsTable.findFirst({
    where: eq(expensePaymentsTable.id, id),
  })

  if (!existing) throw new Error('Expense payment not found')
  if (existing.status === 'paid' || existing.status === 'cancelled') {
    throw new Error('Paid or cancelled expense payments cannot be changed')
  }

  await db
    .update(expensePaymentsTable)
    .set({
      status,
      paymentDate: status === 'paid' ? new Date().toISOString().slice(0, 10) : existing.paymentDate,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(expensePaymentsTable.id, id))

  revalidateExpensePaths()
}

export async function updateExpensePaymentAction(formData: FormData) {
  await requirePermission('expenses', 'edit')

  const id = clean(formData.get('id'))
  if (!id) throw new Error('Payment ID is required')

  const existing = await db.query.expensePaymentsTable.findFirst({
    where: eq(expensePaymentsTable.id, id),
  })

  if (!existing) throw new Error('Expense payment not found')
  if (existing.status === 'paid' || existing.status === 'cancelled') {
    throw new Error('Paid or cancelled expense payments cannot be changed')
  }

  await db
    .update(expensePaymentsTable)
    .set(await getExpensePaymentUpdateValues(formData, existing))
    .where(eq(expensePaymentsTable.id, id))

  revalidateExpensePaths()
}

export async function deleteExpensePaymentAction(formData: FormData) {
  await requirePermission('expenses', 'delete')

  const id = clean(formData.get('id'))
  if (!id) throw new Error('Payment ID is required')

  const existing = await db.query.expensePaymentsTable.findFirst({
    where: eq(expensePaymentsTable.id, id),
  })

  if (!existing) throw new Error('Expense payment not found')
  if (existing.status === 'paid' || existing.status === 'cancelled') {
    throw new Error('Paid or cancelled expense payments cannot be deleted')
  }

  await db.delete(expensePaymentsTable).where(eq(expensePaymentsTable.id, id))
  revalidateExpensePaths()
}

export async function getExpenseDashboardSeries() {
  await requireAuth()

  const [payments, payroll, users] = await Promise.all([
    db.query.expensePaymentsTable.findMany({
      where: eq(expensePaymentsTable.status, 'paid'),
    }),
    getExpenseReportPayrollRows(),
    db.select().from(usersTable),
  ])

  return getCompletedMonthKeys(6).map((key) => {
    const view = calculateExpenseReportMonth(key, payments, payroll)
    const activeEmployees = users.filter((user) => {
      const joinedAt = user.joinedAt || user.createdAt
      return (
        user.isActive &&
        user.personType === 'employee' &&
        user.includeInHeadcount &&
        (!joinedAt || joinedAt.slice(0, 7) <= key)
      )
    }).length

    return {
      month: view.month.shortLabel,
      totalExpenses: view.totals.total,
      payrollExpenses: view.totals.payroll,
      nonPayrollExpenses: view.totals.oneTime + view.totals.recurring,
      activeEmployees,
      expensePerEmployee: activeEmployees > 0 ? Math.round(view.totals.total / activeEmployees) : 0,
    }
  })
}
