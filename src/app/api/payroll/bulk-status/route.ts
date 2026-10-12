import { NextRequest } from 'next/server'
import { and, eq, inArray, notInArray } from 'drizzle-orm'
import { db } from '@/db'
import { additionalPaymentsTable, payrollTable, usersTable } from '@/db/schema'
import { errorResponse, successResponse } from '@/lib/auth-guards'
import { requirePermissionAPI } from '@/lib/permissions'
import {
  emitNotificationEvent,
  getUsersByIdsForNotifications,
  NOTIFICATION_EVENTS,
  toNotificationRecipients,
} from '@/lib/notification-events'
import { writeMemberActivityLog } from '@/lib/member-activity'

type PayrollStatus = 'generated' | 'approved' | 'paid' | 'cancelled'
type BulkStatusRowType = 'payroll' | 'additionalPayment'

type BulkStatusRow = {
  id: string
  type: BulkStatusRowType
}

class BulkStatusError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message)
  }
}

const VALID_STATUSES = new Set<PayrollStatus>(['generated', 'approved', 'paid', 'cancelled'])
const LOCKED_STATUSES: PayrollStatus[] = ['paid', 'cancelled']

const isValidRow = (row: unknown): row is BulkStatusRow => {
  if (!row || typeof row !== 'object') return false

  const candidate = row as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    (candidate.type === 'payroll' || candidate.type === 'additionalPayment')
  )
}

const uniqueRows = (rows: BulkStatusRow[]) => {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = `${row.type}:${row.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function PATCH(request: NextRequest) {
  const user = await requirePermissionAPI('payroll', 'approve')
  if (!user) {
    return errorResponse('Payroll approval access required', 403)
  }

  try {
    const body = await request.json()
    const status = typeof body.status === 'string' ? body.status : ''

    if (!VALID_STATUSES.has(status as PayrollStatus)) {
      return errorResponse('Invalid payroll status')
    }

    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return errorResponse('Select at least one payroll record')
    }

    if (!body.rows.every(isValidRow)) {
      return errorResponse('Invalid payroll selection')
    }

    const rows = uniqueRows(body.rows)
    const payrollIds = rows.filter((row) => row.type === 'payroll').map((row) => row.id)
    const additionalPaymentIds = rows
      .filter((row) => row.type === 'additionalPayment')
      .map((row) => row.id)

    const result = await db.transaction(async (tx) => {
      const payrollRecords =
        payrollIds.length > 0
          ? await tx.select().from(payrollTable).where(inArray(payrollTable.id, payrollIds))
          : []

      const additionalPaymentRecords =
        additionalPaymentIds.length > 0
          ? await tx
              .select()
              .from(additionalPaymentsTable)
              .where(inArray(additionalPaymentsTable.id, additionalPaymentIds))
          : []

      if (payrollRecords.length !== payrollIds.length) {
        throw new BulkStatusError('One or more payroll records could not be found', 404)
      }

      if (additionalPaymentRecords.length !== additionalPaymentIds.length) {
        throw new BulkStatusError('One or more additional payments could not be found', 404)
      }

      const hasLockedPayroll = payrollRecords.some((record) =>
        LOCKED_STATUSES.includes(record.status as PayrollStatus),
      )
      const hasLockedAdditionalPayment = additionalPaymentRecords.some((record) =>
        LOCKED_STATUSES.includes(record.status as PayrollStatus),
      )

      if (hasLockedPayroll || hasLockedAdditionalPayment) {
        throw new BulkStatusError('Paid or cancelled records cannot be changed', 409)
      }

      const now = new Date().toISOString()
      const updatedPayrolls =
        payrollIds.length > 0
          ? await tx
              .update(payrollTable)
              .set({
                status: status as PayrollStatus,
                updatedAt: now,
              })
              .where(
                and(
                  inArray(payrollTable.id, payrollIds),
                  notInArray(payrollTable.status, LOCKED_STATUSES),
                ),
              )
              .returning()
          : []

      const updatedAdditionalPayments =
        additionalPaymentIds.length > 0
          ? await tx
              .update(additionalPaymentsTable)
              .set({
                status: status as PayrollStatus,
                updatedAt: now,
              })
              .where(
                and(
                  inArray(additionalPaymentsTable.id, additionalPaymentIds),
                  notInArray(additionalPaymentsTable.status, LOCKED_STATUSES),
                ),
              )
              .returning({ id: additionalPaymentsTable.id })
          : []

      if (
        updatedPayrolls.length !== payrollIds.length ||
        updatedAdditionalPayments.length !== additionalPaymentIds.length
      ) {
        throw new BulkStatusError('One or more records changed and can no longer be updated', 409)
      }

      return {
        payrollRecords,
        updatedPayrolls,
        updatedCount: updatedPayrolls.length + updatedAdditionalPayments.length,
      }
    })

    const previousPayrollsById = new Map(
      result.payrollRecords.map((record) => [record.id, record]),
    )

    await Promise.all(
      result.updatedPayrolls.map(async (updated) => {
        const previous = previousPayrollsById.get(updated.id)
        if (previous && previous.status !== updated.status) {
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
        }

        if (!previous || previous.status === updated.status) return

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
            previousStatus: previous?.status,
            status: updated.status,
            linkUrl: '/me',
          },
        })
      }),
    )

    return successResponse({
      message: 'Payroll statuses updated successfully',
      updatedCount: result.updatedCount,
    })
  } catch (error) {
    if (error instanceof BulkStatusError) {
      return errorResponse(error.message, error.status)
    }

    console.error('Error bulk updating payroll statuses:', error)
    return errorResponse('Failed to update payroll statuses', 500)
  }
}
