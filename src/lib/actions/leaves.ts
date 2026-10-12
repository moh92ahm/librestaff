'use server'

import { db } from '@/db'
import { leavesTable } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { canAccessTargetUser, requirePermission } from '@/lib/permissions'

export async function updateLeaveDayInline(
  id: string,
  data: { status?: string; user?: string | null },
) {
  const actor = await requirePermission('leaves', data.status ? 'approve' : 'edit')
  const currentLeave = await db.query.leavesTable.findFirst({
    where: eq(leavesTable.id, id),
  })

  if (!currentLeave) {
    throw new Error('Leave not found')
  }

  if (!(await canAccessTargetUser(actor, 'leaves', data.status ? 'approve' : 'edit', currentLeave.userId))) {
    throw new Error('You cannot update this leave record')
  }

  const updateData: any = { updatedAt: new Date() }

  if (data.status) {
    updateData.status = data.status as any
  }

  if (data.user === null) {
    updateData.userId = null
  } else if (data.user) {
    updateData.userId = data.user
  }

  await db.update(leavesTable).set(updateData).where(eq(leavesTable.id, id))

  revalidatePath('/leaves')
}
