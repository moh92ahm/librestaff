import type { Metadata } from 'next'
import { db } from '@/db'
import { getScopedUserIds, hasPermission, requirePermission } from '@/lib/permissions'

import { Tabs, TabsContent } from '@/components/ui/tabs'
import { LeaveDayList } from '@/components/leaves/leave-list'
import { leavesTable } from '@/db/schema'
import { inArray } from 'drizzle-orm'

export const metadata: Metadata = {
  title: 'Leaves',
  description: 'Manage employee leave requests',
}

export default async function Page() {
  const user = await requirePermission('leaves', 'view')
  const [scopedUserIds, canCreateLeaves, canEditLeaves, canApproveLeaves] = await Promise.all([
    getScopedUserIds(user, 'leaves', 'view'),
    hasPermission(user, 'leaves', 'create'),
    hasPermission(user, 'leaves', 'edit'),
    hasPermission(user, 'leaves', 'approve'),
  ])

  const leaves =
    scopedUserIds !== null && scopedUserIds.length === 0
      ? []
      : await db.query.leavesTable.findMany({
          where: scopedUserIds ? inArray(leavesTable.userId, scopedUserIds) : undefined,
          orderBy: (leaves, { desc }) => [desc(leaves.updatedAt)],
          limit: 50,
          with: {
            user: true,
          },
        })

  return (
    <Tabs defaultValue="outline">
      <TabsContent
        value="outline"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="space-y-4 p-4 lg:p-6">
          <LeaveDayList
            data={leaves as any}
            canCreate={canCreateLeaves}
            canEdit={canEditLeaves}
            canUpdateStatus={canApproveLeaves}
          />
        </div>
      </TabsContent>
    </Tabs>
  )
}
