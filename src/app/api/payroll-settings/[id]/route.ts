import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { payrollSettingsTable } from '@/db/schema'
import { errorResponse, successResponse } from '@/lib/auth-guards'
import { canAccessTargetUser, requirePermissionAPI } from '@/lib/permissions'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requirePermissionAPI('payroll', 'delete')
  if (!user) {
    return errorResponse('Payroll setting delete access required', 403)
  }

  try {
    const { id } = await params
    const setting = await db.query.payrollSettingsTable.findFirst({
      where: eq(payrollSettingsTable.id, id),
    })

    if (!setting) {
      return errorResponse('Payroll setting not found', 404)
    }

    if (!(await canAccessTargetUser(user, 'payroll', 'delete', setting.employeeId))) {
      return errorResponse('Payroll setting delete access required', 403)
    }

    const [deleted] = await db
      .delete(payrollSettingsTable)
      .where(eq(payrollSettingsTable.id, id))
      .returning({ id: payrollSettingsTable.id })

    if (!deleted) {
      return errorResponse('Payroll setting not found', 404)
    }

    return successResponse({ message: 'Payroll setting deleted successfully' })
  } catch (error) {
    console.error('Error deleting payroll setting:', error)
    return errorResponse('Failed to delete payroll setting', 500)
  }
}
