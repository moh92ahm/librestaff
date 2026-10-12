import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { additionalPaymentsTable, payrollTable } from '@/db/schema'
import { toAmount, type PayrollExpenseRecord } from '@/lib/expenses'

export function toSalaryPayrollExpense(
  record: typeof payrollTable.$inferSelect & { employee?: { fullName?: string | null } | null },
): PayrollExpenseRecord {
  const itemsTotal = Array.isArray(record.payrollItems)
    ? record.payrollItems.reduce((sum, item) => sum + toAmount((item as any).amount), 0)
    : 0
  const totalAmount = itemsTotal + toAmount(record.bonusAmount) - toAmount(record.deductionAmount)

  return {
    id: `payroll-${record.id}`,
    kind: 'salary',
    label: 'Salary',
    month: record.month,
    year: record.year,
    totalAmount,
    status: record.status,
    employee: record.employee,
  }
}

export function toAdditionalPaymentExpense(
  record: typeof additionalPaymentsTable.$inferSelect & {
    employee?: { fullName?: string | null } | null
  },
): PayrollExpenseRecord {
  return {
    id: `additional-${record.id}`,
    kind: record.category as PayrollExpenseRecord['kind'],
    label: record.category,
    month: record.month,
    year: record.year,
    totalAmount: record.amount,
    status: record.status,
    employee: record.employee,
  }
}

export async function getExpenseReportPayrollRows() {
  const [payroll, additionalPayments] = await Promise.all([
    db.query.payrollTable.findMany({
      where: eq(payrollTable.status, 'paid'),
      with: {
        employee: true,
      },
    }),
    db.query.additionalPaymentsTable.findMany({
      where: eq(additionalPaymentsTable.status, 'paid'),
      with: {
        employee: true,
      },
    }),
  ])

  return [
    ...payroll.map((record) => toSalaryPayrollExpense(record)),
    ...additionalPayments.map((record) => toAdditionalPaymentExpense(record)),
  ]
}
