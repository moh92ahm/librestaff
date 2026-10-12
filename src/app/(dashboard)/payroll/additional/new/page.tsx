import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { and, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { additionalPaymentsTable } from '@/db/schema'
import { getScopedUserIds, requirePermission } from '@/lib/permissions'
import { AdditionalPaymentForm } from '@/components/payroll/forms/additional-payment-form'
import { setFlashToast } from '@/lib/flash-toast'
import { activeEmployeeWhere } from '@/lib/people'
import { usersTable } from '@/db/schema'

export const metadata: Metadata = {
  title: 'New Additional Payment',
  description: 'Create a one-off payroll payment',
}

function normalizeDateInput(value: string) {
  return value.split('T')[0]
}

const additionalPaymentCategories = ['bonus', 'advance', 'commission', 'allowance', 'other'] as const

function parseAdditionalPaymentCategory(value: string) {
  if (additionalPaymentCategories.includes(value as (typeof additionalPaymentCategories)[number])) {
    return value as (typeof additionalPaymentCategories)[number]
  }

  throw new Error('Invalid additional payment category')
}

export default async function NewAdditionalPaymentPage() {
  const user = await requirePermission('payroll', 'create')
  const scopedUserIds = await getScopedUserIds(user, 'payroll', 'create')

  const users = await db.query.usersTable.findMany({
    where: scopedUserIds ? and(activeEmployeeWhere(), inArray(usersTable.id, scopedUserIds)) : activeEmployeeWhere(),
    orderBy: (users, { asc }) => [asc(users.fullName)],
    limit: 100,
  })

  const handleCreate = async (formData: FormData) => {
    'use server'

    const actor = await requirePermission('payroll', 'create')
    const createScopeUserIds = await getScopedUserIds(actor, 'payroll', 'create')

    const employeeId = String(formData.get('employee') || '')
    const category = parseAdditionalPaymentCategory(String(formData.get('category') || 'bonus'))
    const description = String(formData.get('description') || '')
    const amount = Number(formData.get('amount') || 0)
    const paymentType = String(formData.get('paymentType') || 'bankTransfer')
    const month = String(formData.get('month') || '').padStart(2, '0')
    const year = Number(formData.get('year') || 0)
    const status = String(formData.get('status') || 'generated')
    const notes = String(formData.get('notes') || '')
    const paymentDate = String(formData.get('paymentDate') || '')

    if (createScopeUserIds !== null && !createScopeUserIds.includes(employeeId)) {
      throw new Error('You cannot create an additional payment for this employee')
    }

    await db.insert(additionalPaymentsTable).values({
      employeeId,
      category,
      description,
      amount: String(amount),
      paymentType: paymentType as 'bankTransfer' | 'cash' | 'cheque',
      month: month as
        | '01'
        | '02'
        | '03'
        | '04'
        | '05'
        | '06'
        | '07'
        | '08'
        | '09'
        | '10'
        | '11'
        | '12',
      year,
      status: status as 'generated' | 'approved' | 'paid' | 'cancelled',
      notes: notes || null,
      paymentDate: paymentDate ? normalizeDateInput(paymentDate) : null,
    })

    await setFlashToast('success', 'Additional payment created')
    redirect('/payroll')
  }

  return (
    <AdditionalPaymentForm
      formAction={handleCreate}
      employees={users.map((user) => ({ value: user.id, label: user.fullName }))}
    />
  )
}
