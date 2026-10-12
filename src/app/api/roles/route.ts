import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { rolePermissionsTable, rolesTable } from '@/db/schema'
import { requireAdminAPI } from '@/lib/auth-guards'
import { normalizePermissionRows, rolePayloadSchema } from '@/lib/role-permissions'

export async function POST(req: NextRequest) {
  const user = await requireAdminAPI()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
      const existing = await tx
        .select({ id: rolesTable.id })
        .from(rolesTable)
        .where(eq(rolesTable.name, data.name))
        .limit(1)

      if (existing.length > 0) {
        throw new Error('ROLE_EXISTS')
      }

      const [created] = await tx
        .insert(rolesTable)
        .values({
          name: data.name,
          displayName: data.displayName,
          description: data.description || null,
          isSystem: false,
          isActive: data.isActive,
        })
        .returning()

      if (normalizedPermissions.length > 0) {
        await tx.insert(rolePermissionsTable).values(
          normalizedPermissions.map((permission) => ({
            roleId: created.id,
            ...permission,
          })),
        )
      }

      return created
    })

    return NextResponse.json({ role }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'ROLE_EXISTS') {
      return NextResponse.json({ error: 'A role with this name already exists' }, { status: 409 })
    }

    console.error('Error creating role:', error)
    return NextResponse.json({ error: 'Failed to create role' }, { status: 500 })
  }
}
