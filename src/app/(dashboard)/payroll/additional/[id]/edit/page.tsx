import { notFound, redirect } from 'next/navigation'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { additionalPaymentsTable } from '@/db/schema'
import { canAccessTargetUser, getScopedUserIds, requirePermission } from '@/lib/permissions'
import { AdditionalPaymentForm } from '@/components/payroll/forms/additional-payment-form'
import { SetBreadcrumbLabel } from '@/components/set-breadcrumb-label'
import { setFlashToast } from '@/lib/flash-toast'
import { activeEmployeeWhere } from '@/lib/people'
import { usersTable } from '@/db/schema'

interface EditAdditionalPaymentPageProps {
  params: Promise<{ id: string }>
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

export default async function EditAdditionalPaymentPage({
  params,
}: EditAdditionalPaymentPageProps) {
  const { id } = await params
  const user = await requirePermission('payroll', 'edit')
  const scopedUserIds = await getScopedUserIds(user, 'payroll', 'edit')

  const payment = await db.query.additionalPaymentsTable.findFirst({
    where: eq(additionalPaymentsTable.id, id),
    with: {
      employee: true,
    },
  })

  if (!payment) {
    notFound()
  }

  if (!(await canAccessTargetUser(user, 'payroll', 'edit', payment.employeeId))) {
    notFound()
  }

  const users = await db.query.usersTable.findMany({
    where: scopedUserIds ? inArray(usersTable.id, scopedUserIds) : activeEmployeeWhere(),
    orderBy: (users, { asc }) => [asc(users.fullName)],
    limit: 100,
  })

  const handleUpdate = async (formData: FormData) => {
    'use server'

    const actor = await requirePermission('payroll', 'edit')
    const editScopeUserIds = await getScopedUserIds(actor, 'payroll', 'edit')

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

    const currentPayment = await db.query.additionalPaymentsTable.findFirst({
      where: eq(additionalPaymentsTable.id, id),
    })

    if (!currentPayment) {
      throw new Error('Additional payment not found')
    }

    if (!(await canAccessTargetUser(actor, 'payroll', 'edit', currentPayment.employeeId))) {
      throw new Error('You cannot edit this additional payment')
    }

    if (editScopeUserIds !== null && !editScopeUserIds.includes(employeeId)) {
      throw new Error('You cannot assign this additional payment to this employee')
    }

    await db
      .update(additionalPaymentsTable)
      .set({
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
        updatedAt: new Date().toISOString(),
      })
      .where(eq(additionalPaymentsTable.id, id))

    await setFlashToast('success', 'Additional payment updated')
    redirect('/payroll')
  }

  return (
    <>
      <SetBreadcrumbLabel label={payment.description} />
      <AdditionalPaymentForm
        isEdit
        formAction={handleUpdate}
        employees={users.map((user) => ({ value: user.id, label: user.fullName }))}
        defaultValues={{
          employee: payment.employeeId,
          category: payment.category,
          description: payment.description,
          amount: Number(payment.amount),
          paymentType: payment.paymentType,
          month: payment.month as any,
          year: payment.year,
          status: payment.status,
          notes: payment.notes || '',
          paymentDate: payment.paymentDate || '',
        }}
      />
    </>
  )
}
