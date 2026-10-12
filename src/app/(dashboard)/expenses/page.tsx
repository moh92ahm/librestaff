import type { Metadata } from 'next'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { mediaTable, usersTable } from '@/db/schema'
import { requirePermission } from '@/lib/permissions'
import { ExpensesList } from '@/components/expenses/expenses-list'
import { getExpenseReportPayrollRows } from '@/lib/expense-report-data'

export const metadata: Metadata = {
  title: 'Expenses',
  description: 'Track one-time and recurring company expenses',
}

export default async function ExpensesPage() {
  await requirePermission('expenses', 'view')

  const [expenses, rawPayments, payroll, employees] = await Promise.all([
    db.query.expensesTable.findMany({
      orderBy: (expenses, { desc }) => [desc(expenses.updatedAt)],
    }),
    db.query.expensePaymentsTable.findMany({
      orderBy: (payments, { desc }) => [desc(payments.updatedAt), desc(payments.createdAt)],
    }),
    getExpenseReportPayrollRows(),
    db
      .select({
        id: usersTable.id,
        fullName: usersTable.fullName,
        isActive: usersTable.isActive,
      })
      .from(usersTable)
      .where(eq(usersTable.personType, 'employee')),
  ])
  const documentIds = Array.from(
    new Set(
      rawPayments.flatMap((payment) =>
        Array.isArray(payment.documents) ? payment.documents.map((id) => String(id)) : [],
      ),
    ),
  )
  const media =
    documentIds.length > 0
      ? await db.select().from(mediaTable).where(inArray(mediaTable.id, documentIds))
      : []
  const mediaById = new Map(media.map((item) => [item.id, item]))
  const payments = rawPayments.map((payment) => ({
    ...payment,
    documents: Array.isArray(payment.documents)
      ? payment.documents
          .map((id) => mediaById.get(String(id)) || String(id))
          .map((doc) =>
            typeof doc === 'string'
              ? doc
              : {
                  id: doc.id,
                  filename: doc.originalFilename || doc.filename,
                  filesize: doc.filesize,
                  mimeType: doc.mimeType,
                  url: doc.url,
                },
          )
      : [],
  }))

  return (
    <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
      <div className="space-y-4 p-4 lg:p-6">
        <ExpensesList
          expenses={expenses as any}
          payments={payments as any}
          payroll={payroll as any}
          employees={employees}
        />
      </div>
    </div>
  )
}
