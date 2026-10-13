export type ExpenseType = 'oneTime' | 'recurring'
export type ExpenseBillingCycle = 'monthly' | 'quarterly' | 'sixMonthly' | 'yearly'
export type ExpensePaymentStatus = 'generated' | 'approved' | 'paid' | 'cancelled'
export type ExpensePaymentSource = 'single' | 'recurring'

export type ExpenseRecord = {
  id: string
  type: ExpenseType
  name: string
  amount: string | number
  category: string
  vendor?: string | null
  paymentMethod: string
  isReimbursable?: boolean
  reimbursableEmployeeId?: string | null
  notes?: string | null
  billingCycle?: ExpenseBillingCycle | null
  recurringDay?: number | null
  recurringMonth?: number | null
  dueOffsetDays?: number | null
  startDate?: string | null
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export type ExpensePaymentRecord = {
  id: string
  expenseId?: string | null
  type: ExpenseType
  source: ExpensePaymentSource
  status: ExpensePaymentStatus
  expenseMonth: string
  expenseYear: number
  generationDate: string
  dueDate: string
  paymentDate?: string | null
  name: string
  amount: string | number
  category: string
  vendor?: string | null
  paymentMethod: string
  isReimbursable: boolean
  reimbursableEmployeeId?: string | null
  reimbursableEmployee?: { fullName?: string | null } | null
  notes?: string | null
  documents?: Array<
    | string
    | {
        id: string
        filename?: string | null
        originalFilename?: string | null
        filesize?: number | null
        url?: string | null
      }
  > | null
  createdAt?: string
  updatedAt?: string
}

export type PayrollExpenseRecord = {
  id: string
  kind?: 'salary' | 'bonus' | 'advance' | 'commission' | 'allowance' | 'other'
  label?: string
  month: string
  year: number
  totalAmount: string | number
  status: string
  employee?: { fullName?: string | null } | null
}

export type ExpenseMonth = {
  key: string
  year: number
  month: number
  label: string
  shortLabel: string
}

export type ExpenseReportView = {
  month: ExpenseMonth
  oneTimeExpenses: ExpensePaymentRecord[]
  recurringExpenses: ExpensePaymentRecord[]
  payrollExpenses: PayrollExpenseRecord[]
  totals: {
    oneTime: number
    recurring: number
    payroll: number
    total: number
  }
  oneTimeByCategory: Array<{ category: string; total: number }>
}

export type ExpenseView = ExpenseReportView

function formatExpenseMonthName(
  year: number,
  month: number,
  locale = 'en-US',
  monthStyle: 'long' | 'short',
) {
  return new Intl.DateTimeFormat(locale, {
    month: monthStyle,
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

export function toAmount(value: string | number | null | undefined) {
  const amount = typeof value === 'number' ? value : Number(value || 0)
  return Number.isFinite(amount) ? amount : 0
}

export function formatMonthKey(year: number, month: number | string) {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function parseMonthKey(key: string, locale = 'en-US'): ExpenseMonth {
  const [yearValue, monthValue] = key.split('-')
  const year = Number(yearValue)
  const month = Number(monthValue)

  return {
    key,
    year,
    month,
    label: `${formatExpenseMonthName(year, month, locale, 'long')} ${year}`,
    shortLabel: `${formatExpenseMonthName(year, month, locale, 'short')} ${year}`,
  }
}

export function getCurrentMonthKey(now = new Date()) {
  return formatMonthKey(now.getFullYear(), now.getMonth() + 1)
}

export function shiftMonthKey(key: string, offset: number) {
  const month = parseMonthKey(key)
  const date = new Date(month.year, month.month - 1 + offset, 1)
  return formatMonthKey(date.getFullYear(), date.getMonth() + 1)
}

export function getLastMonthKey(now = new Date()) {
  return shiftMonthKey(getCurrentMonthKey(now), -1)
}

export function getRecentClosedMonthKeys(count = 5, now = new Date()) {
  const keys: string[] = []
  let key = getLastMonthKey(now)

  for (let index = 0; index < count; index += 1) {
    keys.push(key)
    key = shiftMonthKey(key, -1)
  }

  return keys
}

export function getMonthBounds(key: string) {
  const month = parseMonthKey(key)
  const start = `${month.key}-01`
  const endDate = new Date(month.year, month.month, 0)
  const end = `${month.key}-${String(endDate.getDate()).padStart(2, '0')}`

  return { start, end, lastDay: endDate.getDate() }
}

export function dateToMonthKey(value?: string | null) {
  if (!value) return null
  return value.slice(0, 7)
}

export function addDaysToDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function getExpenseTargetKey(expense: ExpenseRecord) {
  return dateToMonthKey(expense.startDate)
}

export function getExpenseGenerationDate(expense: ExpenseRecord, key: string) {
  const month = parseMonthKey(key)
  const { lastDay } = getMonthBounds(key)
  const startDay = Number(expense.startDate?.slice(8, 10) || expense.recurringDay || 1)
  const day = Math.min(Math.max(startDay, 1), lastDay)
  return `${month.key}-${String(day).padStart(2, '0')}`
}

export function isRecurringExpenseDue(expense: ExpenseRecord, key: string) {
  if (expense.type !== 'recurring' || !expense.isActive) return false
  if (!expense.billingCycle || !expense.startDate) return false

  const month = parseMonthKey(key)
  const { end, lastDay } = getMonthBounds(key)

  if (expense.startDate > end) return false
  const generationDay = Number(expense.startDate.slice(8, 10) || expense.recurringDay || 1)
  if (generationDay > lastDay) return false

  const startKey = dateToMonthKey(expense.startDate)
  if (!startKey) return false

  const startMonth = parseMonthKey(startKey)
  const monthsSinceStart = (month.year - startMonth.year) * 12 + (month.month - startMonth.month)
  if (monthsSinceStart < 0) return false

  if (expense.billingCycle === 'monthly') return true
  if (expense.billingCycle === 'quarterly') return monthsSinceStart % 3 === 0
  if (expense.billingCycle === 'sixMonthly') return monthsSinceStart % 6 === 0
  return monthsSinceStart % 12 === 0
}

export function getExpenseDueDate(expense: ExpenseRecord, key: string) {
  return addDaysToDate(getExpenseGenerationDate(expense, key), expense.dueOffsetDays ?? 7)
}

export function calculateExpenseReportMonth(
  key: string,
  payments: ExpensePaymentRecord[],
  payroll: PayrollExpenseRecord[],
  locale = 'en-US',
): ExpenseReportView {
  const month = parseMonthKey(key, locale)
  const paidPayments = payments.filter(
    (payment) =>
      payment.status === 'paid' &&
      payment.expenseYear === month.year &&
      String(payment.expenseMonth).padStart(2, '0') === String(month.month).padStart(2, '0'),
  )
  const oneTimeExpenses = paidPayments.filter((payment) => payment.source === 'single')
  const recurringExpenses = paidPayments.filter((payment) => payment.source === 'recurring')
  const payrollExpenses = payroll.filter(
    (payment) =>
      payment.status === 'paid' &&
      payment.year === month.year &&
      String(payment.month).padStart(2, '0') === String(month.month).padStart(2, '0'),
  )

  const oneTime = oneTimeExpenses.reduce((sum, expense) => sum + toAmount(expense.amount), 0)
  const recurring = recurringExpenses.reduce((sum, expense) => sum + toAmount(expense.amount), 0)
  const payrollTotal = payrollExpenses.reduce(
    (sum, payment) => sum + toAmount(payment.totalAmount),
    0,
  )
  const categoryTotals = new Map<string, number>()

  for (const expense of oneTimeExpenses) {
    categoryTotals.set(
      expense.category,
      (categoryTotals.get(expense.category) || 0) + toAmount(expense.amount),
    )
  }

  return {
    month,
    oneTimeExpenses,
    recurringExpenses,
    payrollExpenses,
    totals: {
      oneTime,
      recurring,
      payroll: payrollTotal,
      total: oneTime + recurring + payrollTotal,
    },
    oneTimeByCategory: Array.from(categoryTotals.entries()).map(([category, total]) => ({
      category,
      total,
    })),
  }
}

export function calculateExpenseMonth(
  key: string,
  expenses: ExpenseRecord[],
  payroll: PayrollExpenseRecord[],
): ExpenseView {
  const month = parseMonthKey(key)

  const oneTimeExpenses: ExpensePaymentRecord[] = []
  const recurringExpenses: ExpensePaymentRecord[] = []
  const payrollExpenses = payroll.filter(
    (payment) =>
      payment.status === 'paid' &&
      payment.year === month.year &&
      String(payment.month).padStart(2, '0') === String(month.month).padStart(2, '0'),
  )

  const oneTime = oneTimeExpenses.reduce((sum, expense) => sum + toAmount(expense.amount), 0)
  const recurring = recurringExpenses.reduce((sum, expense) => sum + toAmount(expense.amount), 0)
  const payrollTotal = payrollExpenses.reduce(
    (sum, payment) => sum + toAmount(payment.totalAmount),
    0,
  )

  return {
    month,
    oneTimeExpenses: oneTimeExpenses as any,
    recurringExpenses: recurringExpenses as any,
    payrollExpenses,
    totals: {
      oneTime,
      recurring,
      payroll: payrollTotal,
      total: oneTime + recurring + payrollTotal,
    },
    oneTimeByCategory: [],
  }
}

export function getCompletedMonthKeys(count: number, now = new Date()) {
  return getRecentClosedMonthKeys(count, now).reverse()
}

export function getExportMonthKeys(
  range: 'lastMonth' | 'lastThreeMonths' | 'custom',
  customStart?: string,
  customEnd?: string,
  now = new Date(),
) {
  if (range === 'lastMonth') return [getLastMonthKey(now)]
  if (range === 'lastThreeMonths') return getCompletedMonthKeys(3, now)

  if (!customStart || !customEnd) return []

  const start = dateToMonthKey(customStart)
  const end = dateToMonthKey(customEnd)
  if (!start || !end) return []

  const keys: string[] = []
  let cursor = start
  while (cursor <= end) {
    keys.push(cursor)
    cursor = shiftMonthKey(cursor, 1)
  }

  return keys
}
