'use server'

import { db } from '@/db'
import { inventoryLogsTable, inventoryTable, payrollSettingsTable, usersTable } from '@/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { canAccessTargetUser, requirePermission } from '@/lib/permissions'
import { assertCanUpdateProtectedAdmin, getProtectedAdminErrorMessage } from '@/lib/protected-admin'
import { writeMemberActivityLog } from '@/lib/member-activity'

export async function updateUserStatus(userId: string, isActive: boolean) {
  try {
    // Check authentication
    const actor = await requirePermission('employees', 'edit')
    if (!(await canAccessTargetUser(actor, 'employees', 'edit', userId))) {
      throw new Error('You cannot update this user')
    }
    await assertCanUpdateProtectedAdmin({
      targetUserId: userId,
      nextIsActive: isActive,
    })

    const updatedAt = new Date().toISOString()
    const previous = await db.query.usersTable.findFirst({
      columns: { id: true, fullName: true, isActive: true },
      where: eq(usersTable.id, userId),
    })

    await db.transaction(async (tx) => {
      await tx.update(usersTable).set({ isActive, updatedAt }).where(eq(usersTable.id, userId))

      if (!isActive) {
        await tx
          .update(payrollSettingsTable)
          .set({ isActive: false, updatedAt })
          .where(
            and(
              eq(payrollSettingsTable.employeeId, userId),
              eq(payrollSettingsTable.isActive, true),
            ),
          )

        const assignedInventory = await tx
          .select({
            id: inventoryTable.id,
            model: inventoryTable.model,
            status: inventoryTable.status,
          })
          .from(inventoryTable)
          .where(eq(inventoryTable.holderId, userId))

        if (assignedInventory.length > 0) {
          await tx
            .update(inventoryTable)
            .set({
              holderId: null,
              updatedAt,
            })
            .where(eq(inventoryTable.holderId, userId))

          const inUseItemIds = assignedInventory
            .filter((item) => item.status === 'inUse')
            .map((item) => item.id)
          if (inUseItemIds.length > 0) {
            await tx
              .update(inventoryTable)
              .set({ status: 'inStock', updatedAt })
              .where(inArray(inventoryTable.id, inUseItemIds))
          }

          await tx.insert(inventoryLogsTable).values(
            assignedInventory.flatMap((item) => {
              const logs: Array<typeof inventoryLogsTable.$inferInsert> = [
                {
                  inventoryId: item.id,
                  eventType: 'holderChanged',
                  oldValue: userId,
                  newValue: null,
                  oldLabel: previous?.fullName || userId,
                  newLabel: 'Unassigned',
                  actorUserId: actor.id,
                  createdAt: updatedAt,
                },
              ]

              if (item.status === 'inUse') {
                logs.push({
                  inventoryId: item.id,
                  eventType: 'statusChanged',
                  oldValue: item.status,
                  newValue: 'inStock',
                  oldLabel: item.status,
                  newLabel: 'In Stock',
                  actorUserId: actor.id,
                  createdAt: updatedAt,
                })
              }

              return logs
            }),
          )
        }
      }
    })

    if (previous && previous.isActive !== isActive) {
      await writeMemberActivityLog({
        subjectUserId: userId,
        actorUserId: actor.id,
        eventType: isActive ? 'employee.reactivated' : 'employee.deactivated',
        sourceType: 'employee',
        sourceId: userId,
        sourceLabel: previous.fullName,
        sourceKey: `employee.status:${userId}:${updatedAt}`,
        metadata: {
          employeeName: previous.fullName,
          previousStatus: previous.isActive ? 'active' : 'inactive',
          status: isActive ? 'active' : 'inactive',
          linkUrl: `/team-members/${userId}`,
        },
        createdAt: updatedAt,
      })
    }

    // Revalidate the user pages to show updated status
    revalidatePath('/team-members')
    revalidatePath(`/team-members/${userId}`)
    revalidatePath('/calendar')
    revalidatePath('/payroll/settings')
    revalidatePath('/inventory')
    revalidatePath(`/users/${userId}`)

    return { success: true }
  } catch (error) {
    console.error('Error updating user status:', error)
    const message = await getProtectedAdminErrorMessage(error)
    throw new Error(message || 'Failed to update user status')
  }
}
