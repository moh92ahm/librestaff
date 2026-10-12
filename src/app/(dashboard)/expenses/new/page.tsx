import type { Metadata } from 'next'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { usersTable } from '@/db/schema'
import { ExpenseForm, ExpenseFormPage } from '@/components/expenses/expense-form'
import { createExpenseAction } from '@/lib/actions/expenses'
import { requirePermission } from '@/lib/permissions'
import { getTranslations } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'New Expense',
  description: 'Create a one-time or recurring company expense',
}

export default async function NewExpensePage() {
  await requirePermission('expenses', 'create')
  const t = await getTranslations('expenses')

  const employees = await db
    .select({
      id: usersTable.id,
      fullName: usersTable.fullName,
      isActive: usersTable.isActive,
    })
    .from(usersTable)
    .where(eq(usersTable.personType, 'employee'))
    .orderBy(asc(usersTable.fullName))

  return (
    <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
      <div className="mx-auto w-full max-w-5xl space-y-4 p-4 lg:p-6">
        <ExpenseFormPage title={t('newPayment')} description={t('settingsDescription')}>
          <ExpenseForm action={createExpenseAction} employees={employees} />
        </ExpenseFormPage>
      </div>
    </div>
  )
}
