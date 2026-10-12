import { describe, expect, it } from 'vitest'
import {
  calculateExpenseReportMonth,
  getCompletedMonthKeys,
  getExpenseDueDate,
  getExpenseGenerationDate,
  getExportMonthKeys,
  isRecurringExpenseDue,
  parseMonthKey,
  type ExpensePaymentRecord,
  type ExpenseRecord,
  type PayrollExpenseRecord,
} from '@/lib/expenses'

const basePayment = {
  expenseId: null,
  type: 'oneTime',
  paymentMethod: 'bankTransfer',
  vendor: null,
  notes: null,
  isReimbursable: false,
  reimbursableEmployeeId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} satisfies Partial<ExpensePaymentRecord>

const baseRecurring = {
  type: 'recurring',
  vendor: null,
  paymentMethod: 'bankTransfer',
  notes: null,
  dueOffsetDays: 7,
  isReimbursable: false,
  reimbursableEmployeeId: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} satisfies Partial<ExpenseRecord>

describe('expense calculations', () => {
  it('counts only paid single transactions in their expense month', () => {
    const payments: ExpensePaymentRecord[] = [
      {
        ...basePayment,
        id: 'single-paid',
        source: 'single',
        status: 'paid',
        name: 'Laptop',
        amount: '1000',
        category: 'laptop',
        expenseMonth: '05',
        expenseYear: 2026,
        generationDate: '2026-05-15',
        dueDate: '2026-05-22',
        paymentDate: '2026-06-01',
      },
      {
        ...basePayment,
        id: 'single-generated',
        source: 'single',
        status: 'generated',
        name: 'Software',
        amount: '200',
        category: 'software',
        expenseMonth: '05',
        expenseYear: 2026,
        generationDate: '2026-05-10',
        dueDate: '2026-05-17',
      },
    ]

    const may = calculateExpenseReportMonth('2026-05', payments, [])
    const june = calculateExpenseReportMonth('2026-06', payments, [])

    expect(may.totals.oneTime).toBe(1000)
    expect(june.totals.oneTime).toBe(0)
  })

  it('counts paid payroll by payroll period and excludes unpaid statuses', () => {
    const payroll: PayrollExpenseRecord[] = [
      {
        id: 'payroll-1',
        month: '05',
        year: 2026,
        totalAmount: '5000',
        status: 'paid',
        paymentDate: '2026-06-05',
      } as PayrollExpenseRecord,
      {
        id: 'payroll-2',
        month: '05',
        year: 2026,
        totalAmount: '3000',
        status: 'approved',
      },
    ]

    const may = calculateExpenseReportMonth('2026-05', [], payroll)
    const june = calculateExpenseReportMonth('2026-06', [], payroll)

    expect(may.totals.payroll).toBe(5000)
    expect(june.totals.payroll).toBe(0)
  })

  it('anchors recurring generation and due date from the start date', () => {
    const expense: ExpenseRecord = {
      ...baseRecurring,
      id: 'recurring-1',
      name: 'Software',
      amount: '75',
      category: 'software',
      billingCycle: 'monthly',
      recurringDay: 5,
      startDate: '2026-05-05',
    } as ExpenseRecord

    expect(isRecurringExpenseDue(expense, '2026-06')).toBe(true)
    expect(getExpenseGenerationDate(expense, '2026-06')).toBe('2026-06-05')
    expect(getExpenseDueDate(expense, '2026-06')).toBe('2026-06-12')
  })

  it('supports quarterly, six-month, and yearly recurring cycles', () => {
    const quarterly = {
      ...baseRecurring,
      id: 'quarterly',
      name: 'Quarterly',
      amount: '300',
      category: 'software',
      billingCycle: 'quarterly',
      recurringDay: 10,
      startDate: '2026-01-10',
    } as ExpenseRecord
    const sixMonthly = {
      ...quarterly,
      id: 'six-monthly',
      billingCycle: 'sixMonthly',
    } as ExpenseRecord
    const yearly = {
      ...quarterly,
      id: 'yearly',
      billingCycle: 'yearly',
    } as ExpenseRecord

    expect(isRecurringExpenseDue(quarterly, '2026-04')).toBe(true)
    expect(isRecurringExpenseDue(quarterly, '2026-05')).toBe(false)
    expect(isRecurringExpenseDue(sixMonthly, '2026-07')).toBe(true)
    expect(isRecurringExpenseDue(sixMonthly, '2026-04')).toBe(false)
    expect(isRecurringExpenseDue(yearly, '2027-01')).toBe(true)
    expect(isRecurringExpenseDue(yearly, '2026-07')).toBe(false)
  })

  it('uses completed months for export presets and dashboard series', () => {
    const now = new Date('2026-06-09T12:00:00.000Z')

    expect(getExportMonthKeys('lastMonth', undefined, undefined, now)).toEqual(['2026-05'])
    expect(getExportMonthKeys('lastThreeMonths', undefined, undefined, now)).toEqual([
      '2026-03',
      '2026-04',
      '2026-05',
    ])
    expect(getCompletedMonthKeys(3, now)).toEqual(['2026-03', '2026-04', '2026-05'])
  })

  it('formats month labels with the requested locale', () => {
    expect(parseMonthKey('2026-05').label).toBe('May 2026')
    expect(parseMonthKey('2026-05', 'tr').label).toBe('Mayıs 2026')
    expect(calculateExpenseReportMonth('2026-08', [], [], 'tr').month.label).toBe('Ağustos 2026')
  })
})
