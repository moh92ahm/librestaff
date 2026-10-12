import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { payrollTable, usersTable } from '@/db/schema'
import { errorResponse, successResponse } from '@/lib/auth-guards'
import { requirePermissionAPI } from '@/lib/permissions'
import {
  emitNotificationEvent,
  getUsersByIdsForNotifications,
  NOTIFICATION_EVENTS,
  toNotificationRecipients,
} from '@/lib/notification-events'
import { writeMemberActivityLog } from '@/lib/member-activity'

const VALID_STATUSES = new Set(['generated', 'approved', 'paid', 'cancelled'])

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermissionAPI('payroll', 'approve')
  if (!user) {
    return errorResponse('Payroll approval access required', 403)
  }

  try {
    const { id } = await params
    const body = await request.json()
    const status = typeof body.status === 'string' ? body.status : ''

    if (!VALID_STATUSES.has(status)) {
      return errorResponse('Invalid payroll status')
    }

    const previous = await db.query.payrollTable.findFirst({
      where: eq(payrollTable.id, id),
    })

    if (!previous) {
      return errorResponse('Payroll record not found', 404)
    }

    if (previous.status === 'paid' || previous.status === 'cancelled') {
      return errorResponse('Paid or cancelled payroll records cannot be changed', 409)
    }

    const [updated] = await db
      .update(payrollTable)
      .set({
        status: status as 'generated' | 'approved' | 'paid' | 'cancelled',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(payrollTable.id, id))
      .returning()

    await writeMemberActivityLog({
      subjectUserId: updated.employeeId,
      actorUserId: user.id,
      eventType: 'payroll.status_changed',
      sourceType: 'payroll',
      sourceId: updated.id,
      sourceLabel: `${updated.month}/${updated.year} payroll`,
      sourceKey: `payroll.status_changed:${updated.id}:${previous.status}:${updated.status}`,
      metadata: {
        month: updated.month,
        year: updated.year,
        totalAmount: updated.totalAmount,
        previousStatus: previous.status,
        status: updated.status,
        linkUrl: '/payroll',
      },
      createdAt: updated.updatedAt,
    })

    if (previous.status !== updated.status) {
      const [employee] = await db
        .select({ fullName: usersTable.fullName })
        .from(usersTable)
        .where(eq(usersTable.id, updated.employeeId))
        .limit(1)

      await emitNotificationEvent({
        eventType: NOTIFICATION_EVENTS.payrollStatusChanged,
        sourceType: 'payroll',
        sourceId: updated.id,
        sourceKey: `${NOTIFICATION_EVENTS.payrollStatusChanged}:payroll:${updated.id}:${previous.status}:${updated.status}`,
        actorUserId: user.id,
        recipients: toNotificationRecipients(
          await getUsersByIdsForNotifications([updated.employeeId]),
        ),
        payload: {
          payrollId: updated.id,
          subjectUserId: updated.employeeId,
          employeeId: updated.employeeId,
          employeeName: employee?.fullName || 'Employee',
          month: updated.month,
          year: updated.year,
          totalAmount: updated.totalAmount,
          previousStatus: previous.status,
          status: updated.status,
          linkUrl: '/me',
        },
      })
    }

    return successResponse({ message: 'Payroll status updated successfully' })
  } catch (error) {
    console.error('Error updating payroll status:', error)
    return errorResponse('Failed to update payroll status', 500)
  }
}
