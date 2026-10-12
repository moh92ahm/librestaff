import { NextRequest, NextResponse } from 'next/server'
import { count, eq } from 'drizzle-orm'
import { db } from '@/db'
import { rolePermissionsTable, rolesTable, usersTable } from '@/db/schema'
import { requireAdminAPI } from '@/lib/auth-guards'
import { normalizePermissionRows, rolePayloadSchema } from '@/lib/role-permissions'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminAPI()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = rolePayloadSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid role data' },
      { status: 400 },
    )
  }

  const data = parsed.data
  const normalizedPermissions = normalizePermissionRows(data.permissions)

  try {
    const role = await db.transaction(async (tx) => {
      const [currentRole] = await tx
        .select()
        .from(rolesTable)
        .where(eq(rolesTable.id, id))
        .limit(1)

      if (!currentRole) {
        throw new Error('ROLE_NOT_FOUND')
      }

      if (currentRole.isSystem) {
        throw new Error('SYSTEM_ROLE')
      }

      const duplicateName = await tx
        .select({ id: rolesTable.id })
        .from(rolesTable)
        .where(eq(rolesTable.name, data.name))
        .limit(1)

      if (duplicateName.some((role) => role.id !== id)) {
        throw new Error('ROLE_EXISTS')
      }

      const [updated] = await tx
        .update(rolesTable)
        .set({
          name: data.name,
          displayName: data.displayName,
          description: data.description || null,
          isActive: data.isActive,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(rolesTable.id, id))
        .returning()

      await tx.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, id))

      if (normalizedPermissions.length > 0) {
        await tx.insert(rolePermissionsTable).values(
          normalizedPermissions.map((permission) => ({
            roleId: id,
            ...permission,
          })),
        )
      }

      return updated
    })

    return NextResponse.json({ role })
  } catch (error) {
    if (error instanceof Error && error.message === 'ROLE_NOT_FOUND') {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'SYSTEM_ROLE') {
      return NextResponse.json({ error: 'System roles cannot be edited' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'ROLE_EXISTS') {
      return NextResponse.json({ error: 'A role with this name already exists' }, { status: 409 })
    }

    console.error('Error updating role:', error)
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminAPI()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    await db.transaction(async (tx) => {
      const [role] = await tx.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1)

      if (!role) {
        throw new Error('ROLE_NOT_FOUND')
      }

      if (role.isSystem) {
        throw new Error('SYSTEM_ROLE')
      }

      const [assignmentCount] = await tx
        .select({ count: count() })
        .from(usersTable)
        .where(eq(usersTable.roleId, id))

      if (Number(assignmentCount?.count || 0) > 0) {
        throw new Error('ROLE_ASSIGNED')
      }

      await tx.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, id))
      await tx.delete(rolesTable).where(eq(rolesTable.id, id))
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'ROLE_NOT_FOUND') {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'SYSTEM_ROLE') {
      return NextResponse.json({ error: 'System roles cannot be deleted' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'ROLE_ASSIGNED') {
      return NextResponse.json(
        { error: 'Roles assigned to users cannot be deleted' },
        { status: 409 },
      )
    }

    console.error('Error deleting role:', error)
    return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 })
  }
}
