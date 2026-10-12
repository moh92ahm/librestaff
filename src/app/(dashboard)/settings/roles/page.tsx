import type { Metadata } from 'next'
import { count, asc } from 'drizzle-orm'
import { db } from '@/db'
import { rolesTable, usersTable } from '@/db/schema'
import { RolesSettings, type RoleSettingsItem } from '@/components/settings/roles-settings'
import { groupPermissionRows } from '@/lib/role-permissions'

export const metadata: Metadata = {
  title: 'Roles & Permissions',
  description: 'Manage custom roles and permissions',
}

export default async function RolesSettingsPage() {
  const [roles, assignmentCounts] = await Promise.all([
    db.query.rolesTable.findMany({
      orderBy: (roles, { asc }) => [asc(roles.isSystem), asc(roles.displayName)],
      with: {
        permissions: true,
      },
    }),
    db
      .select({ roleId: usersTable.roleId, count: count() })
      .from(usersTable)
      .groupBy(usersTable.roleId),
  ])

  const countByRoleId = new Map(
    assignmentCounts.map((row) => [row.roleId || '', Number(row.count || 0)]),
  )

  const roleItems: RoleSettingsItem[] = roles.map((role) => ({
    id: role.id,
    name: role.name,
    displayName: role.displayName,
    description: role.description,
    isSystem: role.isSystem,
    isActive: role.isActive,
    userCount: countByRoleId.get(role.id) || 0,
    permissions: groupPermissionRows(role.permissions),
  }))

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col gap-4 overflow-auto px-4 lg:px-6">
      <div className="w-full space-y-4 p-4 lg:p-6">
        <RolesSettings roles={roleItems} />
      </div>
    </div>
  )
}
