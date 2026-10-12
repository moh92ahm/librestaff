import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { payrollTable } from '@/db/schema'
import { errorResponse, successResponse } from '@/lib/auth-guards'
import { requirePermissionAPI } from '@/lib/permissions'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requirePermissionAPI('payroll', 'delete')
  if (!user) {
    return errorResponse('Payroll delete access required', 403)
  }

  try {
    const { id } = await params
    const [deleted] = await db
      .delete(payrollTable)
      .where(eq(payrollTable.id, id))
      .returning({ id: payrollTable.id })

    if (!deleted) {
      return errorResponse('Payroll record not found', 404)
    }

    return successResponse({ message: 'Payroll record deleted successfully' })
  } catch (error) {
    console.error('Error deleting payroll record:', error)
    return errorResponse('Failed to delete payroll record', 500)
  }
}
