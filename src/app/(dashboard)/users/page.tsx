import type { Metadata } from 'next'
import { db } from '@/db'
import { getScopedUserIds, hasPermission, requirePermission } from '@/lib/permissions'

import { Tabs, TabsContent } from '@/components/ui/tabs'
import { UserList } from '@/components/user/user-list'
import { rolesTable, usersTable } from '@/db/schema'
import { asc, eq, inArray } from 'drizzle-orm'

export const metadata: Metadata = {
  title: 'Users',
  description: 'Manage users and team members',
}

export default async function Page() {
  const currentUser = await requirePermission('employees', 'view')
  const [scopedUserIds, canCreateTeamMembers, canEditTeamMembers] = await Promise.all([
    getScopedUserIds(currentUser, 'employees', 'view'),
    hasPermission(currentUser, 'employees', 'create'),
    hasPermission(currentUser, 'employees', 'edit'),
  ])

  const [users, roles] = await Promise.all([
    scopedUserIds !== null && scopedUserIds.length === 0
      ? []
      : db.query.usersTable.findMany({
          where: scopedUserIds ? inArray(usersTable.id, scopedUserIds) : undefined,
          orderBy: (users, { desc }) => [desc(users.joinedAt)],
          limit: 50,
          with: {
            role: true,
            department: true,
          },
        }),
    db
      .select()
      .from(rolesTable)
      .where(eq(rolesTable.isActive, true))
      .orderBy(asc(rolesTable.name)),
  ])

  return (
    <Tabs defaultValue="outline">
      <TabsContent
        value="outline"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="space-y-4 p-4 lg:p-6">
          <UserList
            data={users}
            canInvite={canCreateTeamMembers}
            canCreate={canCreateTeamMembers}
            canEdit={canEditTeamMembers}
            roles={roles.map((role) => ({
              value: role.id,
              label: role.displayName,
              name: role.name,
            }))}
          />
        </div>
      </TabsContent>
    </Tabs>
  )
}
