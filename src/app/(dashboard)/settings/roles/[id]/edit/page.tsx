import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { rolesTable } from '@/db/schema'
import { RoleForm } from '@/components/settings/role-form'
import { groupPermissionRows } from '@/lib/role-permissions'

export const metadata: Metadata = {
  title: 'Edit Role',
}

export default async function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const role = await db.query.rolesTable.findFirst({
    where: eq(rolesTable.id, id),
    with: {
      permissions: true,
    },
  })

  if (!role || role.isSystem) {
    notFound()
  }

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col gap-4 overflow-auto px-4 lg:px-6">
      <div className="w-full space-y-4 p-4 lg:p-6">
        <RoleForm
          mode="edit"
          role={{
            id: role.id,
            name: role.name,
            displayName: role.displayName,
            description: role.description || '',
            isActive: role.isActive,
            permissions: groupPermissionRows(role.permissions),
          }}
        />
      </div>
    </div>
  )
}
