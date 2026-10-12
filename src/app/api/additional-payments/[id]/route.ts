import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { additionalPaymentsTable } from '@/db/schema'
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
      .delete(additionalPaymentsTable)
      .where(eq(additionalPaymentsTable.id, id))
      .returning({ id: additionalPaymentsTable.id })

    if (!deleted) {
      return errorResponse('Additional payment not found', 404)
    }

    return successResponse({ message: 'Additional payment deleted successfully' })
  } catch (error) {
    console.error('Error deleting additional payment:', error)
    return errorResponse('Failed to delete additional payment', 500)
  }
}
