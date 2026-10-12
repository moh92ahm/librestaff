import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { and, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { getScopedUserIds, requirePermission } from '@/lib/permissions'
import { payrollSettingsTable, usersTable } from '@/db/schema'
import { SettingsForm } from '@/components/payroll/forms/settings-form'
import { setFlashToast } from '@/lib/flash-toast'
import { activeEmployeeWhere } from '@/lib/people'
import { writeMemberActivityLog } from '@/lib/member-activity'

export const metadata: Metadata = {
  title: 'New Payroll Setting',
  description: 'Create a new payroll setting',
}

function normalizeDateInput(value: string) {
  return value.split('T')[0]
}

export default async function NewPayrollSettingPage() {
  const user = await requirePermission('payroll', 'create')
  const scopedUserIds = await getScopedUserIds(user, 'payroll', 'create')

  // Fetch user options for employee select
  const users = await db.query.usersTable.findMany({
    where: scopedUserIds ? and(activeEmployeeWhere(), inArray(usersTable.id, scopedUserIds)) : activeEmployeeWhere(),
    orderBy: (users, { asc }) => [asc(users.fullName)],
    limit: 100,
  })

  const handleCreateSetting = async (formData: FormData) => {
    'use server'

    const actor = await requirePermission('payroll', 'create')
    const createScopeUserIds = await getScopedUserIds(actor, 'payroll', 'create')

    const employeeId = String(formData.get('employee') || '')
    const description = String(formData.get('description') || '')
    const amount = Number(formData.get('amount') || 0)
    const paymentType = String(formData.get('paymentType') || 'bankTransfer')
    const rawPaymentFrequency = String(formData.get('paymentFrequency') || 'monthly')
    const paymentFrequency =
      rawPaymentFrequency === 'quarterly' || rawPaymentFrequency === 'annual'
        ? rawPaymentFrequency
        : 'monthly'
    const accountNumber = String(formData.get('accountNumber') || '')
    const bankName = String(formData.get('bankName') || '')
    const accountHolderName = String(formData.get('accountHolderName') || '')
    const swiftCode = String(formData.get('swiftCode') || '')
    const isActive = formData.get('isActive') === 'on' || formData.get('isActive') === 'true'
    const startDate = String(formData.get('startDate') || '')
    const endDate = String(formData.get('endDate') || '')
    const notes = String(formData.get('notes') || '')

    if (createScopeUserIds !== null && !createScopeUserIds.includes(employeeId)) {
      throw new Error('You cannot create payroll settings for this employee')
    }

    const [createdSetting] = await db.insert(payrollSettingsTable).values({
      employeeId,
      payrollType: 'primary',
      description: description || null,
      amount: String(amount),
      paymentType: paymentType as 'bankTransfer' | 'cash' | 'cheque',
      paymentFrequency,
      bankAccount: {
        accountNumber: accountNumber || undefined,
        bankName: bankName || undefined,
        accountHolderName: accountHolderName || undefined,
        swiftCode: swiftCode || undefined,
      },
      isActive,
      startDate: normalizeDateInput(startDate),
      endDate: endDate ? normalizeDateInput(endDate) : null,
      notes: notes || null,
    }).returning()

    if (createdSetting) {
      await writeMemberActivityLog({
        subjectUserId: createdSetting.employeeId,
        actorUserId: actor.id,
        eventType: 'payroll_setting.created',
        sourceType: 'payroll_setting',
        sourceId: createdSetting.id,
        sourceLabel: createdSetting.description || 'Payroll setting',
        sourceKey: `payroll_setting.created:${createdSetting.id}`,
        metadata: {
          description: createdSetting.description,
          amount: createdSetting.amount,
          paymentFrequency: createdSetting.paymentFrequency,
          paymentType: createdSetting.paymentType,
          isActive: createdSetting.isActive,
          startDate: createdSetting.startDate,
          endDate: createdSetting.endDate,
          linkUrl: '/payroll/settings',
        },
        createdAt: createdSetting.createdAt,
      })
    }

    await setFlashToast('success', 'Payroll setting created')
    redirect('/payroll/settings')
  }

  return (
    <>
      <SettingsForm
        mode="create"
        formAction={handleCreateSetting}
        employees={users.map((u) => ({
          value: String(u.id),
          label: u.fullName,
          joinedAt: u.joinedAt,
        }))}
      />
    </>
  )
}
