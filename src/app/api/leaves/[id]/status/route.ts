import { NextRequest } from 'next/server'
import { db } from '@/db'
import { leavesTable, usersTable } from '@/db/schema'
import {
  errorResponse,
  forbiddenResponse,
  successResponse,
} from '@/lib/auth-guards'
import { canAccessTargetUser, requirePermissionAPI } from '@/lib/permissions'
import { getLeavePolicyConfig } from '@/lib/leave-policy-db'
import { getAnnualLeaveBalance } from '@/lib/leave-policy'
import { eq, and, ne } from 'drizzle-orm'
import {
  emitNotificationEvent,
  getLeaveRecipientsForNotifications,
  NOTIFICATION_EVENTS,
} from '@/lib/notification-events'
import { writeMemberActivityLog } from '@/lib/member-activity'

const VALID_STATUSES = new Set(['requested', 'approved', 'rejected', 'cancelled'])

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermissionAPI('leaves', 'approve')
  if (!user) {
    return forbiddenResponse('Leave approval access required')
  }

  try {
    const { id } = await params
    const body = await request.json()
    const status = String(body.status || '')

    if (!VALID_STATUSES.has(status)) {
      return errorResponse('Invalid leave status')
    }

    const leave = await db.query.leavesTable.findFirst({
      where: eq(leavesTable.id, id),
    })

    if (!leave) {
      return errorResponse('Leave not found', 404)
    }

    if (!(await canAccessTargetUser(user, 'leaves', 'approve', leave.userId))) {
      return forbiddenResponse('You can only update leave requests within your permitted scope')
    }

    if (leave.status !== 'requested') {
      return forbiddenResponse('Only requested leave records can be updated')
    }

    if (status === 'approved' && leave.type === 'annual') {
      const { policy, tiers } = await getLeavePolicyConfig()

      if (!policy.allowNegativeBalance) {
        const leaveUser = await db.query.usersTable.findFirst({
          where: eq(usersTable.id, leave.userId),
        })

        if (!leaveUser) {
          return errorResponse('Leave user not found', 404)
        }

        const userLeaves = await db.query.leavesTable.findMany({
          where: and(eq(leavesTable.userId, leave.userId), ne(leavesTable.id, leave.id)),
        })
        const balance = getAnnualLeaveBalance(leaveUser, userLeaves, tiers, policy)
        const projectedRemaining = balance.available - (leave.totalDays || 0)

        if (projectedRemaining < 0) {
          return errorResponse('Approving this leave would exceed the available annual balance')
        }
      }
    }

    const [updated] = await db
      .update(leavesTable)
      .set({
        status: status as 'requested' | 'approved' | 'rejected' | 'cancelled',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(leavesTable.id, id))
      .returning()

    const leaveUser = await db.query.usersTable.findFirst({
      columns: { id: true, fullName: true },
      where: eq(usersTable.id, updated.userId),
    })

    await writeMemberActivityLog({
      subjectUserId: updated.userId,
      actorUserId: user.id,
      eventType: 'leave.status_changed',
      sourceType: 'leave',
      sourceId: updated.id,
      sourceLabel: `${updated.type} leave`,
      sourceKey: `leave.status_changed:${updated.id}:${leave.status}:${updated.status}`,
      metadata: {
        leaveType: updated.type,
        previousStatus: leave.status,
        status: updated.status,
        startDate: updated.startDate,
        endDate: updated.endDate,
        totalDays: updated.totalDays,
        linkUrl: '/leaves',
      },
      createdAt: updated.updatedAt,
    })

    await emitNotificationEvent({
      eventType: NOTIFICATION_EVENTS.leaveUpdated,
      sourceType: 'leave',
      sourceId: updated.id,
      sourceKey: `${NOTIFICATION_EVENTS.leaveUpdated}:leave:${updated.id}:${updated.status}`,
      actorUserId: user.id,
      recipients: await getLeaveRecipientsForNotifications(updated.userId),
      payload: {
        leaveId: updated.id,
        subjectUserId: updated.userId,
        employeeId: updated.userId,
        employeeName: leaveUser?.fullName || 'Employee',
        leaveType: updated.type,
        previousStatus: leave.status,
        status: updated.status,
        startDate: updated.startDate,
        endDate: updated.endDate,
        totalDays: updated.totalDays,
        linkUrl: '/leaves',
      },
    })

    return successResponse({ leave: updated })
  } catch (error) {
    console.error('Error updating leave status:', error)
    return errorResponse('Failed to update leave status', 500)
  }
}
