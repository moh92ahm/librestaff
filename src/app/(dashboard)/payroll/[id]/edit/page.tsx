import { redirect, notFound } from 'next/navigation'
import { inArray } from 'drizzle-orm'
import { db } from '@/db'
import { canAccessTargetUser, getScopedUserIds, requirePermission } from '@/lib/permissions'
import { payrollSettingsTable, payrollTable } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { PayrollForm } from '@/components/payroll/forms/payroll-form'
import { SetBreadcrumbLabel } from '@/components/set-breadcrumb-label'
import { setFlashToast } from '@/lib/flash-toast'
import { activeEmployeeWhere } from '@/lib/people'
import { usersTable } from '@/db/schema'
import { getActivityChanges, writeMemberActivityLog } from '@/lib/member-activity'

interface EditPayrollPageProps {
  params: Promise<{ id: string }>
}

export default async function EditPayrollPage({ params }: EditPayrollPageProps) {
  const { id } = await params
  const user = await requirePermission('payroll', 'edit')
  const scopedUserIds = await getScopedUserIds(user, 'payroll', 'edit')

  try {
    const payrollItem = await db.query.payrollTable.findFirst({
      where: eq(payrollTable.id, id),
      with: {
        employee: true,
      },
    })

    if (!payrollItem) {
      notFound()
    }

    if (!(await canAccessTargetUser(user, 'payroll', 'edit', payrollItem.employeeId))) {
      notFound()
    }

    const payrollItems = Array.isArray(payrollItem.payrollItems) ? payrollItem.payrollItems : []
    const payrollSettingIds = payrollItems
      .filter((item) => item.paymentType === 'bankTransfer')
      .map((item) => item.payrollSettingId)
      .filter(Boolean)

    const [users, bankTransferSettings] = await Promise.all([
      db.query.usersTable.findMany({
        where: scopedUserIds ? inArray(usersTable.id, scopedUserIds) : activeEmployeeWhere(),
        orderBy: (users, { asc }) => [asc(users.fullName)],
        limit: 100,
      }),
      payrollSettingIds.length > 0
        ? db.query.payrollSettingsTable.findMany({
            where: inArray(payrollSettingsTable.id, payrollSettingIds),
          })
        : Promise.resolve([]),
    ])

    // Prepare employees list before passing to client component
    const employeeOptions = users.map((u) => ({
      value: String(u.id),
      label: u.fullName,
    }))

    const employeeName = payrollItem.employee?.fullName || 'Payroll'

    return (
      <>
        <SetBreadcrumbLabel label={`${employeeName} - ${payrollItem.month}/${payrollItem.year}`} />
        <PayrollForm
          mode="edit"
          initialData={payrollItem}
          formAction={handleUpdate.bind(null, id)}
          employees={employeeOptions}
          bankTransferDetails={bankTransferSettings
            .filter((setting) => setting.paymentType === 'bankTransfer' && setting.bankAccount)
            .map((setting) => ({
              id: setting.id,
              description: setting.description || 'Bank transfer salary',
              accountNumber: setting.bankAccount?.accountNumber || '',
              bankName: setting.bankAccount?.bankName || '',
              accountHolderName: setting.bankAccount?.accountHolderName || '',
              swiftCode: setting.bankAccount?.swiftCode || '',
            }))}
        />
      </>
    )
  } catch (_error) {
    notFound()
  }
}

async function handleUpdate(payrollId: string, formData: FormData) {
  'use server'

  const actor = await requirePermission('payroll', 'edit')
  const bonusAmount = Number(formData.get('bonusAmount') || 0)
  const deductionAmount = Number(formData.get('deductionAmount') || 0)
  const adjustmentNote = String(formData.get('adjustmentNote') || '')

  // Fetch the current payroll item to get existing payroll items
  const currentPayroll = await db.query.payrollTable.findFirst({
    where: eq(payrollTable.id, payrollId),
  })

  if (!currentPayroll) {
    throw new Error('Payroll not found')
  }

  if (!(await canAccessTargetUser(actor, 'payroll', 'edit', currentPayroll.employeeId))) {
    throw new Error('You cannot edit this payroll record')
  }

  // Parse existing payroll items
  const existingItems = currentPayroll.payrollItems || []

  // Calculate total amount
  const itemsTotal = existingItems.reduce((sum: number, item: any) => sum + (item.amount || 0), 0)
  const totalAmount = itemsTotal + bonusAmount - deductionAmount

  const updatedAt = new Date().toISOString()
  const [updatedPayroll] = await db
    .update(payrollTable)
    .set({
      bonusAmount: String(bonusAmount),
      deductionAmount: String(deductionAmount),
      adjustmentNote: adjustmentNote || null,
      totalAmount: String(totalAmount),
      updatedAt,
    })
    .where(
      and(eq(payrollTable.id, payrollId), eq(payrollTable.employeeId, currentPayroll.employeeId)),
    )
    .returning()

  if (updatedPayroll) {
    const changes = getActivityChanges(
      currentPayroll as any,
      updatedPayroll as any,
      [
        { field: 'bonusAmount', label: 'Bonus amount' },
        { field: 'deductionAmount', label: 'Deduction amount' },
        { field: 'adjustmentNote', label: 'Adjustment note' },
        { field: 'totalAmount', label: 'Total amount' },
      ] as any,
    )

    if (changes.length > 0) {
      await writeMemberActivityLog({
        subjectUserId: updatedPayroll.employeeId,
        actorUserId: actor.id,
        eventType: 'payroll.updated',
        sourceType: 'payroll',
        sourceId: updatedPayroll.id,
        sourceLabel: `${updatedPayroll.month}/${updatedPayroll.year} payroll`,
        sourceKey: `payroll.updated:${updatedPayroll.id}:${updatedAt}`,
        metadata: {
          changes,
          month: updatedPayroll.month,
          year: updatedPayroll.year,
          totalAmount: updatedPayroll.totalAmount,
          status: updatedPayroll.status,
          linkUrl: '/payroll',
        },
        createdAt: updatedAt,
      })
    }
  }

  await setFlashToast('success', 'Payroll updated')
  redirect('/payroll')
}
