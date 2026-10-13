import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { additionalPaymentsTable } from '@/db/schema'
import { errorResponse, successResponse } from '@/lib/auth-guards'
import { requirePermissionAPI } from '@/lib/permissions'

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
      return errorResponse('Invalid payment status')
    }

    const previous = await db.query.additionalPaymentsTable.findFirst({
      where: eq(additionalPaymentsTable.id, id),
    })

    if (!previous) {
      return errorResponse('Additional payment not found', 404)
    }

    if (previous.status === 'paid' || previous.status === 'cancelled') {
      return errorResponse('Paid or cancelled payments cannot be changed', 409)
    }

    await db
      .update(additionalPaymentsTable)
      .set({
        status: status as 'generated' | 'approved' | 'paid' | 'cancelled',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(additionalPaymentsTable.id, id))

    return successResponse({ message: 'Additional payment status updated successfully' })
  } catch (error) {
    console.error('Error updating additional payment status:', error)
    return errorResponse('Failed to update additional payment status', 500)
  }
}
