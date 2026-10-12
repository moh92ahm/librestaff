import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { expensesTable, usersTable } from '@/db/schema'
import { ExpenseForm, ExpenseFormPage } from '@/components/expenses/expense-form'
import { updateExpenseAction } from '@/lib/actions/expenses'
import { requirePermission } from '@/lib/permissions'
import { getTranslations } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Edit Expense',
  description: 'Update a recurring company expense',
}

interface EditExpensePageProps {
  params: Promise<{ id: string }>
}

export default async function EditExpensePage({ params }: EditExpensePageProps) {
  const { id } = await params
  await requirePermission('expenses', 'edit')
  const t = await getTranslations('expenses')

  const [expense, employees] = await Promise.all([
    db.query.expensesTable.findFirst({
      where: eq(expensesTable.id, id),
    }),
    db
      .select({
        id: usersTable.id,
        fullName: usersTable.fullName,
        isActive: usersTable.isActive,
      })
      .from(usersTable)
      .where(eq(usersTable.personType, 'employee'))
      .orderBy(asc(usersTable.fullName)),
  ])

  if (!expense) {
    notFound()
  }

  return (
    <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
      <div className="mx-auto w-full max-w-5xl space-y-4 p-4 lg:p-6">
        <ExpenseFormPage title={t('editExpense')} description={t('settingsDescription')}>
          <ExpenseForm
            expense={expense as any}
            fixedSource="recurring"
            employees={employees}
            action={updateExpenseAction}
          />
        </ExpenseFormPage>
      </div>
    </div>
  )
}
