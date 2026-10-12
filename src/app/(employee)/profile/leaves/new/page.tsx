import { redirect } from 'next/navigation'
import { db } from '@/db'
import { leavesTable, usersTable } from '@/db/schema'
import { getCurrentUser } from '@/lib/auth'
import { LeaveDayForm } from '@/components/leaves/forms/leave-form'
import { requireAuth } from '@/lib/auth-guards'
import { getAnnualLeaveBalancesForUsers, getLeavePolicyConfig } from '@/lib/leave-policy-db'
import { parseLeaveFormData, resolveLeaveAttachmentIds } from '@/lib/leave-form-data'
import {
  getCompanyCalendarHolidayDates,
  getCompanyHolidayDatesForLeaveRange,
} from '@/lib/company-holidays'
import { eq } from 'drizzle-orm'
import { setFlashToast } from '@/lib/flash-toast'
import {
  emitNotificationEvent,
  getLeaveRecipientsForNotifications,
  NOTIFICATION_EVENTS,
} from '@/lib/notification-events'
import { writeMemberActivityLog } from '@/lib/member-activity'

export default async function EmployeeCreateLeavePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const requesterOption = {
    value: String(user.id),
    label: user.name || user.email || 'Current User',
  }
  const dbUser = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, String(user.id)),
  })

  if (!dbUser) {
    redirect('/login')
  }

  const [{ policy }, leaveBalances, holidayDates] = await Promise.all([
    getLeavePolicyConfig(),
    getAnnualLeaveBalancesForUsers([dbUser]),
    getCompanyCalendarHolidayDates(),
  ])

  const handleCreateLeave = async (formData: FormData) => {
    'use server'

    const user = await requireAuth()
    const { policy } = await getLeavePolicyConfig()
    const holidayDates = await getCompanyHolidayDatesForLeaveRange(
      String(formData.get('startDate') || ''),
      String(formData.get('endDate') || ''),
    )

    const data = parseLeaveFormData(formData, {
      policy,
      holidayDates,
      canOverrideDays: false,
      defaultUserId: user.id,
      defaultStatus: 'requested',
    })

    const [created] = await db
      .insert(leavesTable)
      .values({ ...data, attachments: await resolveLeaveAttachmentIds(formData) })
      .returning()

    await writeMemberActivityLog({
      subjectUserId: created.userId,
      actorUserId: user.id,
      eventType: 'leave.requested',
      sourceType: 'leave',
      sourceId: created.id,
      sourceLabel: `${created.type} leave`,
      sourceKey: `leave.requested:${created.id}`,
      metadata: {
        leaveType: created.type,
        status: created.status,
        startDate: created.startDate,
        endDate: created.endDate,
        totalDays: created.totalDays,
        reason: created.reason,
        linkUrl: '/me',
      },
    })

    await emitNotificationEvent({
      eventType: NOTIFICATION_EVENTS.leaveRequested,
      sourceType: 'leave',
      sourceId: created.id,
      actorUserId: user.id,
      recipients: await getLeaveRecipientsForNotifications(created.userId),
      payload: {
        leaveId: created.id,
        subjectUserId: created.userId,
        employeeId: created.userId,
        employeeName: requesterOption.label,
        leaveType: created.type,
        status: created.status,
        startDate: created.startDate,
        endDate: created.endDate,
        totalDays: created.totalDays,
        linkUrl: '/leaves',
      },
    })

    await setFlashToast('success', 'Leave request submitted')
    redirect('/me')
  }

  return (
    <LeaveDayForm
      mode="create"
      formAction={handleCreateLeave}
      users={[requesterOption]}
      lockedUserOption={requesterOption}
      returnHref="/me"
      policy={policy}
      holidayDates={holidayDates}
      leaveBalances={leaveBalances}
    />
  )
}
