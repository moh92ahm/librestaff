import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { rolePermissionsTable, rolesTable } from '@/db/schema'
import { requireAdminAPI } from '@/lib/auth-guards'
import { isPermissionActionAllowedForResource } from '@/lib/role-permissions'

async function nextRoleName(baseName: string) {
  const sanitized = `${baseName}_copy`.slice(0, 42)
  for (let index = 1; index < 100; index++) {
    const candidate = index === 1 ? sanitized : `${sanitized}_${index}`
    const existing = await db
      .select({ id: rolesTable.id })
      .from(rolesTable)
      .where(eq(rolesTable.name, candidate))
      .limit(1)

    if (existing.length === 0) return candidate
  }

  return `${sanitized}_${Date.now().toString().slice(-6)}`.slice(0, 50)
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminAPI()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const sourceRole = await db.query.rolesTable.findFirst({
      where: eq(rolesTable.id, id),
      with: {
        permissions: true,
      },
    })

    if (!sourceRole) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    const role = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(rolesTable)
        .values({
          name: await nextRoleName(sourceRole.name),
          displayName: `${sourceRole.displayName} Copy`.slice(0, 100),
          description: sourceRole.description,
          isSystem: false,
          isActive: true,
        })
        .returning()

      const validPermissions = sourceRole.permissions.filter((permission) =>
        isPermissionActionAllowedForResource(permission.resource, permission.action),
      )
      if (validPermissions.length > 0) {
        await tx.insert(rolePermissionsTable).values(
          validPermissions.map((permission) => ({
            roleId: created.id,
            resource: permission.resource,
            action: permission.action,
            scope: permission.scope,
          })),
        )
      }

      return created
    })

    return NextResponse.json({ role }, { status: 201 })
  } catch (error) {
    console.error('Error duplicating role:', error)
    return NextResponse.json({ error: 'Failed to duplicate role' }, { status: 500 })
  }
}
