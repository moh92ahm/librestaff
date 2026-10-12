import { redirect, notFound } from 'next/navigation'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { canAccessTargetUser, getScopedUserIds, requirePermission } from '@/lib/permissions'
import { payrollSettingsTable, usersTable } from '@/db/schema'
import { SettingsForm } from '@/components/payroll/forms/settings-form'
import { SetBreadcrumbLabel } from '@/components/set-breadcrumb-label'
import { setFlashToast } from '@/lib/flash-toast'
import { activeEmployeeWhere } from '@/lib/people'
import {
  getActivityChanges,
  writeMemberActivityLog,
  writeMemberActivityLogs,
} from '@/lib/member-activity'

interface EditPayrollSettingPageProps {
  params: Promise<{ id: string }>
}

function normalizeDateInput(value: string) {
  return value.split('T')[0]
}

export default async function EditPayrollSettingPage({ params }: EditPayrollSettingPageProps) {
  const { id } = await params
  const user = await requirePermission('payroll', 'edit')
  const scopedUserIds = await getScopedUserIds(user, 'payroll', 'edit')

  try {
    const settingItem = await db.query.payrollSettingsTable.findFirst({
      where: eq(payrollSettingsTable.id, id),
      with: {
        employee: true,
      },
    })

    if (!settingItem) {
      notFound()
    }

    if (!(await canAccessTargetUser(user, 'payroll', 'edit', settingItem.employeeId))) {
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

      const currentSetting = await db.query.payrollSettingsTable.findFirst({
        where: eq(payrollSettingsTable.id, id),
      })

      if (!currentSetting) {
        throw new Error('Payroll setting not found')
      }

      if (!(await canAccessTargetUser(actor, 'payroll', 'edit', currentSetting.employeeId))) {
        throw new Error('You cannot edit this payroll setting')
      }

      if (editScopeUserIds !== null && !editScopeUserIds.includes(employeeId)) {
        throw new Error('You cannot assign this payroll setting to this employee')
      }

      const updatedAt = new Date().toISOString()
      const [updatedSetting] = await db
        .update(payrollSettingsTable)
        .set({
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
          updatedAt,
        })
        .where(
          and(
            eq(payrollSettingsTable.id, id),
            eq(payrollSettingsTable.employeeId, currentSetting.employeeId),
          ),
        )
        .returning()

      if (updatedSetting) {
        const changes = getActivityChanges(
          currentSetting as any,
          updatedSetting as any,
          [
            { field: 'employeeId', label: 'Employee' },
            { field: 'description', label: 'Description' },
            { field: 'amount', label: 'Amount' },
            { field: 'paymentType', label: 'Payment type' },
            { field: 'paymentFrequency', label: 'Payment frequency' },
            { field: 'bankAccount', label: 'Bank account' },
            { field: 'isActive', label: 'Active status' },
            { field: 'startDate', label: 'Start date' },
            { field: 'endDate', label: 'End date' },
            { field: 'notes', label: 'Notes' },
          ] as any,
        )

        if (changes.length > 0) {
          const baseActivity = {
            actorUserId: actor.id,
            eventType: 'payroll_setting.updated',
            sourceType: 'payroll_setting',
            sourceId: updatedSetting.id,
            sourceLabel: updatedSetting.description || 'Payroll setting',
            metadata: {
              changes,
              description: updatedSetting.description,
              amount: updatedSetting.amount,
              paymentFrequency: updatedSetting.paymentFrequency,
              paymentType: updatedSetting.paymentType,
              isActive: updatedSetting.isActive,
              startDate: updatedSetting.startDate,
              endDate: updatedSetting.endDate,
              linkUrl: '/payroll/settings',
            },
            createdAt: updatedAt,
          }

          if (currentSetting.employeeId !== updatedSetting.employeeId) {
            await writeMemberActivityLogs([
              {
                ...baseActivity,
                subjectUserId: currentSetting.employeeId,
                sourceKey: `payroll_setting.updated:${updatedSetting.id}:${currentSetting.employeeId}:${updatedAt}`,
              },
              {
                ...baseActivity,
                subjectUserId: updatedSetting.employeeId,
                sourceKey: `payroll_setting.updated:${updatedSetting.id}:${updatedSetting.employeeId}:${updatedAt}`,
              },
            ])
          } else {
            await writeMemberActivityLog({
              ...baseActivity,
              subjectUserId: updatedSetting.employeeId,
              sourceKey: `payroll_setting.updated:${updatedSetting.id}:${updatedAt}`,
            })
          }
        }
      }

      await setFlashToast('success', 'Payroll setting updated')
      redirect('/payroll/settings')
    }

    const employeeName = settingItem.employee?.fullName || 'Setting'

    const label = settingItem.description || `${employeeName} - ${settingItem.paymentFrequency}`

    return (
      <>
        <SetBreadcrumbLabel label={label} />
        <SettingsForm
          mode="edit"
          initialData={settingItem}
          formAction={handleUpdate}
          employees={users.map((u) => ({
            value: String(u.id),
            label: u.fullName,
            joinedAt: u.joinedAt,
          }))}
        />
      </>
    )
  } catch (e) {
    notFound()
  }
}
