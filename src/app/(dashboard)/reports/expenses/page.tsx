import type { Metadata } from 'next'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { expensePaymentsTable } from '@/db/schema'
import { requirePermission } from '@/lib/permissions'
import { getExpenseReportPayrollRows } from '@/lib/expense-report-data'
import { ExpenseReport } from '@/components/expenses/expense-report'

export const metadata: Metadata = {
  title: 'Expense Reports',
  description: 'Closed-month accrual expense reports',
}

export default async function ExpenseReportsPage() {
  await requirePermission('expenses', 'view')

  const [payments, payroll] = await Promise.all([
    db.query.expensePaymentsTable.findMany({
      where: eq(expensePaymentsTable.status, 'paid'),
      orderBy: (payments, { desc }) => [desc(payments.updatedAt)],
    }),
    getExpenseReportPayrollRows(),
  ])

  return (
    <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
      <div className="space-y-4 p-4 lg:p-6">
        <ExpenseReport payments={payments as any} payroll={payroll as any} />
      </div>
    </div>
  )
}
