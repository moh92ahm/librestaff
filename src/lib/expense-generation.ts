import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { expensePaymentsTable, expensesTable } from '@/db/schema'
import {
  formatMonthKey,
  getExpenseGenerationDate,
  getCurrentMonthKey,
  getExpenseDueDate,
  isRecurringExpenseDue,
  parseMonthKey,
  type ExpenseRecord,
} from '@/lib/expenses'
import {
  emitNotificationEvent,
  getFullAccessRecipientsForNotifications,
  NOTIFICATION_EVENTS,
  toNotificationRecipients,
} from '@/lib/notification-events'

function formatDateForDb(date: Date) {
  return date.toISOString().slice(0, 10)
}

function paymentSnapshot(expense: ExpenseRecord, key: string) {
  const month = parseMonthKey(key)
  const generationDate = getExpenseGenerationDate(expense, key)
  return {
    expenseId: expense.id,
    type: expense.type,
    source: 'recurring' as const,
    expenseMonth: String(month.month).padStart(2, '0'),
    expenseYear: month.year,
    generationDate,
    dueDate: getExpenseDueDate(expense, key),
    name: expense.name,
    amount: String(expense.amount),
    category: expense.category,
    vendor: expense.vendor || null,
    paymentMethod: expense.paymentMethod as 'bankTransfer' | 'cash' | 'cheque' | 'creditCard' | 'other',
    isReimbursable: Boolean(expense.isReimbursable),
    reimbursableEmployeeId: expense.isReimbursable ? expense.reimbursableEmployeeId || null : null,
    notes: expense.notes || null,
    status: 'generated' as const,
  }
}

async function emitExpensePaymentEvent(
  eventType:
    | typeof NOTIFICATION_EVENTS.expenseGenerationDue
    | typeof NOTIFICATION_EVENTS.expensePaymentDue
    | typeof NOTIFICATION_EVENTS.expensePaymentGenerated,
  payment: typeof expensePaymentsTable.$inferSelect,
  sourceKeySuffix: string,
) {
  await emitNotificationEvent({
    eventType,
    sourceType: 'expense_payment',
    sourceId: payment.id,
    sourceKey: `${eventType}:expense_payment:${payment.id}:${sourceKeySuffix}`,
    recipients: toNotificationRecipients(await getFullAccessRecipientsForNotifications()),
    payload: {
      expensePaymentId: payment.id,
      expenseId: payment.expenseId,
      name: payment.name,
      category: payment.category,
      amount: payment.amount,
      generationDate: payment.generationDate,
      dueDate: payment.dueDate,
      linkUrl: '/expenses',
    },
    processImmediately: false,
  })
}

export async function generateExpensePaymentsForMonth(monthKey: string) {
  const expenses = (await db.query.expensesTable.findMany({
    where: and(eq(expensesTable.type, 'recurring'), eq(expensesTable.isActive, true)),
  })) as ExpenseRecord[]
  const created = []

  for (const expense of expenses) {
    const shouldGenerate = isRecurringExpenseDue(expense, monthKey)

    if (!shouldGenerate) continue

    const month = parseMonthKey(monthKey)
    const existing = await db.query.expensePaymentsTable.findFirst({
      where: and(
        eq(expensePaymentsTable.expenseId, expense.id),
        eq(expensePaymentsTable.expenseMonth, String(month.month).padStart(2, '0')),
        eq(expensePaymentsTable.expenseYear, month.year),
      ),
    })

    if (existing) continue

    const [payment] = await db
      .insert(expensePaymentsTable)
      .values(paymentSnapshot(expense, monthKey))
      .returning()

    await emitExpensePaymentEvent(
      NOTIFICATION_EVENTS.expensePaymentGenerated,
      payment,
      `${payment.expenseYear}-${payment.expenseMonth}`,
    )

    created.push(payment)
  }

  return created
}

export async function generateDueExpensePayments(today = new Date()) {
  const todayKey = getCurrentMonthKey(today)
  const expenses = (await db.query.expensesTable.findMany({
    where: and(eq(expensesTable.type, 'recurring'), eq(expensesTable.isActive, true)),
  })) as ExpenseRecord[]
  const created = []
  const todayDate = formatDateForDb(today)

  for (const expense of expenses) {
    if (!isRecurringExpenseDue(expense, todayKey)) continue
    if (getExpenseGenerationDate(expense, todayKey) !== todayDate) continue

    const generated = await generateExpensePaymentsForMonth(todayKey)
    for (const payment of generated) {
      await emitExpensePaymentEvent(
        NOTIFICATION_EVENTS.expenseGenerationDue,
        payment,
        payment.generationDate,
      )
    }
    created.push(...generated)
  }

  const duePayments = await db.query.expensePaymentsTable.findMany({
    where: and(eq(expensePaymentsTable.source, 'recurring'), eq(expensePaymentsTable.dueDate, todayDate)),
  })

  for (const payment of duePayments) {
    if (payment.status === 'paid' || payment.status === 'cancelled') continue
    await emitExpensePaymentEvent(NOTIFICATION_EVENTS.expensePaymentDue, payment, payment.dueDate)
  }

  const byId = new Map(created.map((payment) => [payment.id, payment]))
  return Array.from(byId.values())
}

export function getExpensePaymentPeriod(month: string, year: number) {
  return formatMonthKey(year, month)
}
