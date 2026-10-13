import { redirect, notFound } from 'next/navigation'
import { db } from '@/db'
import { canAccessTargetUser, requirePermission } from '@/lib/permissions'
import { leavesTable, mediaTable, usersTable } from '@/db/schema'
import { LeaveDayForm } from '@/components/leaves/forms/leave-form'
import { eq, asc, inArray } from 'drizzle-orm'
import { getAnnualLeaveBalancesForUsers, getLeavePolicyConfig } from '@/lib/leave-policy-db'
import { activeEmployeeWhere } from '@/lib/people'
import { parseLeaveFormData, resolveLeaveAttachmentIds } from '@/lib/leave-form-data'
import {
  getCompanyCalendarHolidayDates,
  getCompanyHolidayDatesForLeaveRange,
} from '@/lib/company-holidays'
import { setFlashToast } from '@/lib/flash-toast'
import { getActivityChanges, writeMemberActivityLog } from '@/lib/member-activity'

interface EditLeavePageProps {
  params: Promise<{ id: string }>
}

export default async function EditLeavePage({ params }: EditLeavePageProps) {
  const { id } = await params
  const actor = await requirePermission('leaves', 'edit')

  try {
    const leaveItem = await db.query.leavesTable.findFirst({
      where: eq(leavesTable.id, id),
      with: {
        user: true,
      },
    })

    if (!leaveItem) {
      notFound()
    }

    if (!(await canAccessTargetUser(actor, 'leaves', 'edit', leaveItem.userId))) {
      notFound()
    }

    const users = await db
      .select()
      .from(usersTable)
      .where(activeEmployeeWhere())
      .orderBy(asc(usersTable.fullName))
    const [{ policy }, leaveBalances, holidayDates] = await Promise.all([
      getLeavePolicyConfig(),
      getAnnualLeaveBalancesForUsers(users),
      getCompanyCalendarHolidayDates(),
    ])

    const handleUpdate = async (formData: FormData) => {
      'use server'

      const updateActor = await requirePermission('leaves', 'edit')
      const currentLeave = await db.query.leavesTable.findFirst({
        where: eq(leavesTable.id, id),
      })

      if (!currentLeave || currentLeave.status !== 'requested') {
        redirect('/leaves')
      }
      if (!(await canAccessTargetUser(updateActor, 'leaves', 'edit', currentLeave.userId))) {
        redirect('/leaves')
      }

      const { policy } = await getLeavePolicyConfig()
      const holidayDates = await getCompanyHolidayDatesForLeaveRange(
        String(formData.get('startDate') || ''),
        String(formData.get('endDate') || ''),
      )
      const data = {
        ...parseLeaveFormData(formData, {
          policy,
          holidayDates,
          canOverrideDays: true,
        }),
        attachments: await resolveLeaveAttachmentIds(formData, currentLeave.attachments),
        updatedAt: new Date().toISOString(),
      }

      const [updatedLeave] = await db
        .update(leavesTable)
        .set(data)
        .where(eq(leavesTable.id, id))
        .returning()
      const changes = updatedLeave
        ? getActivityChanges(
            currentLeave as any,
            updatedLeave as any,
            [
              { field: 'type', label: 'Leave type' },
              { field: 'startDate', label: 'Start date' },
              { field: 'endDate', label: 'End date' },
              { field: 'totalDays', label: 'Charged days' },
              { field: 'autoCalculatedDays', label: 'Calculated days' },
              { field: 'isManualDayCount', label: 'Manual day count' },
              { field: 'manualDayCountReason', label: 'Manual day count reason' },
              { field: 'status', label: 'Status' },
              { field: 'reason', label: 'Reason' },
              { field: 'note', label: 'Note' },
            ] as any,
          )
        : []

      if (updatedLeave && changes.length > 0) {
        await writeMemberActivityLog({
          subjectUserId: updatedLeave.userId,
          actorUserId: updateActor.id,
          eventType: 'leave.updated',
          sourceType: 'leave',
          sourceId: updatedLeave.id,
          sourceLabel: `${updatedLeave.type} leave`,
          sourceKey: `leave.updated:${updatedLeave.id}:${updatedLeave.updatedAt}`,
          metadata: {
            changes,
            leaveType: updatedLeave.type,
            status: updatedLeave.status,
            startDate: updatedLeave.startDate,
            endDate: updatedLeave.endDate,
            totalDays: updatedLeave.totalDays,
            linkUrl: '/leaves',
          },
          createdAt: updatedLeave.updatedAt,
        })
      }
      await setFlashToast('success', 'Leave request updated')
      redirect('/leaves')
    }

    const attachmentIds = Array.isArray(leaveItem.attachments) ? leaveItem.attachments : []
    const attachmentMedia =
      attachmentIds.length > 0
        ? await db.select().from(mediaTable).where(inArray(mediaTable.id, attachmentIds))
        : []
    const mediaById = new Map(attachmentMedia.map((item) => [item.id, item]))
    const hydratedLeave = {
      ...leaveItem,
      attachments: attachmentIds.map((id) => {
        const media = mediaById.get(id)
        return media
          ? {
              id: media.id,
              filename: media.originalFilename || media.filename,
              filesize: media.filesize,
              mimeType: media.mimeType,
              url: media.url,
            }
          : id
      }),
    }

    return (
      <>
        <LeaveDayForm
          mode="edit"
          initialData={hydratedLeave}
          formAction={handleUpdate}
          users={users.map((u) => ({ value: String(u.id), label: u.fullName }))}
          lockedUserOption={{
            value: leaveItem.userId,
            label: leaveItem.user?.fullName || leaveItem.userId,
          }}
          policy={policy}
          holidayDates={holidayDates}
          leaveBalances={leaveBalances}
          canOverrideDays
        />
      </>
    )
  } catch (_error) {
    notFound()
  }
}
