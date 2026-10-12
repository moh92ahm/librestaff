import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { getScopedUserIds, requirePermission } from '@/lib/permissions'
import { leavesTable, usersTable } from '@/db/schema'
import { LeaveDayForm } from '@/components/leaves/forms/leave-form'
import { and, asc, inArray } from 'drizzle-orm'
import { getAnnualLeaveBalancesForUsers, getLeavePolicyConfig } from '@/lib/leave-policy-db'
import { activeEmployeeWhere } from '@/lib/people'
import { parseLeaveFormData, resolveLeaveAttachmentIds } from '@/lib/leave-form-data'
import {
  getCompanyCalendarHolidayDates,
  getCompanyHolidayDatesForLeaveRange,
} from '@/lib/company-holidays'
import { setFlashToast } from '@/lib/flash-toast'
import {
  emitNotificationEvent,
  getLeaveRecipientsForNotifications,
  NOTIFICATION_EVENTS,
} from '@/lib/notification-events'
import { writeMemberActivityLog } from '@/lib/member-activity'

export const metadata: Metadata = {
  title: 'New Leave Request',
  description: 'Create a new leave request',
}

export default async function NewLeavePage() {
  const user = await requirePermission('leaves', 'create')
  const scopedUserIds = await getScopedUserIds(user, 'leaves', 'create')

  // Fetch user options for user select
  const users =
    scopedUserIds !== null && scopedUserIds.length === 0
      ? []
      : await db
          .select()
          .from(usersTable)
          .where(
            scopedUserIds
              ? and(activeEmployeeWhere(), inArray(usersTable.id, scopedUserIds))
              : activeEmployeeWhere(),
          )
          .orderBy(asc(usersTable.fullName))
  const [{ policy }, leaveBalances, holidayDates] = await Promise.all([
    getLeavePolicyConfig(),
    getAnnualLeaveBalancesForUsers(users),
    getCompanyCalendarHolidayDates(),
  ])

  const handleCreateLeave = async (formData: FormData) => {
    'use server'

    const actor = await requirePermission('leaves', 'create')
    const { policy } = await getLeavePolicyConfig()
    const holidayDates = await getCompanyHolidayDatesForLeaveRange(
      String(formData.get('startDate') || ''),
      String(formData.get('endDate') || ''),
    )
    const data = parseLeaveFormData(formData, {
      policy,
      holidayDates,
      canOverrideDays: true,
      defaultStatus: 'requested',
    })
    const createScopeUserIds = await getScopedUserIds(actor, 'leaves', 'create')
    if (createScopeUserIds !== null && !createScopeUserIds.includes(data.userId)) {
      throw new Error('You cannot create leave requests for this user')
    }

    const [created] = await db
      .insert(leavesTable)
      .values({ ...data, attachments: await resolveLeaveAttachmentIds(formData) })
      .returning()
    const leaveUser = users.find((item) => item.id === created.userId)

    await writeMemberActivityLog({
      subjectUserId: created.userId,
      actorUserId: actor.id,
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
        linkUrl: '/leaves',
      },
    })

    await emitNotificationEvent({
      eventType: NOTIFICATION_EVENTS.leaveRequested,
      sourceType: 'leave',
      sourceId: created.id,
      actorUserId: actor.id,
      recipients: await getLeaveRecipientsForNotifications(created.userId),
      payload: {
        leaveId: created.id,
        subjectUserId: created.userId,
        employeeId: created.userId,
        employeeName: leaveUser?.fullName || 'Employee',
        leaveType: created.type,
        status: created.status,
        startDate: created.startDate,
        endDate: created.endDate,
        totalDays: created.totalDays,
        linkUrl: '/leaves',
      },
    })

    await setFlashToast('success', 'Leave request created')
    redirect('/leaves')
  }

  return (
    <>
      <LeaveDayForm
        mode="create"
        formAction={handleCreateLeave}
        users={users.map((u) => ({ value: String(u.id), label: u.fullName }))}
        policy={policy}
        holidayDates={holidayDates}
        leaveBalances={leaveBalances}
        canOverrideDays
      />
    </>
  )
}
