import { and, count, eq } from 'drizzle-orm'
import { db } from '@/db'
import { rolesTable, usersTable } from '@/db/schema'
import { getRootDepartment, ROOT_DEPARTMENT_NAME } from '@/lib/root-department'

type UserUpdateProtectionInput = {
  targetUserId: string
  nextRoleId?: string | null
  nextIsActive?: boolean
}

export async function assertCanUpdateProtectedAdmin({
  targetUserId,
  nextRoleId,
  nextIsActive,
}: UserUpdateProtectionInput) {
  const target = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, targetUserId),
    with: {
      role: true,
    },
  })

  if (!target) {
    throw new Error('USER_NOT_FOUND')
  }

  const nextRole =
    nextRoleId === undefined || nextRoleId === null
      ? target.role
      : await db.query.rolesTable.findFirst({
          where: eq(rolesTable.id, nextRoleId),
        })

  if (nextRoleId && !nextRole) {
    throw new Error('ROLE_NOT_FOUND')
  }

  if (nextRoleId && nextRole && !nextRole.isActive && nextRole.name !== 'admin') {
    throw new Error('ROLE_INACTIVE')
  }

  if (target.isProtectedAdmin) {
    if (nextIsActive === false) {
      throw new Error('PROTECTED_ADMIN')
    }

    if (nextRole && nextRole.name !== 'admin') {
      throw new Error('PROTECTED_ADMIN')
    }
  }

  const rootDepartment = await getRootDepartment()
  if (rootDepartment?.managerUserId === targetUserId) {
    if (nextIsActive === false) {
      throw new Error('ROOT_DEPARTMENT_MANAGER')
    }

    if (nextRole && nextRole.name !== 'admin') {
      throw new Error('ROOT_DEPARTMENT_MANAGER')
    }
  }

  if (target.role?.name === 'admin' && nextRole && nextRole.name !== 'admin') {
    const [adminCount] = await db
      .select({ count: count() })
      .from(usersTable)
      .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
      .where(and(eq(rolesTable.name, 'admin'), eq(usersTable.isActive, true)))

    if (Number(adminCount?.count || 0) <= 1) {
      throw new Error('LAST_ADMIN')
    }
  }

  if (target.role?.name === 'admin' && nextIsActive === false) {
    const [otherAdminCount] = await db
      .select({ count: count() })
      .from(usersTable)
      .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
      .where(and(eq(rolesTable.name, 'admin'), eq(usersTable.isActive, true)))

    if (Number(otherAdminCount?.count || 0) <= 1) {
      throw new Error('LAST_ADMIN')
    }
  }
}

export async function getProtectedAdminErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return null

  const messages: Record<string, string> = {
    PROTECTED_ADMIN: 'The protected admin cannot be deactivated or demoted.',
    ROOT_DEPARTMENT_MANAGER: `The ${ROOT_DEPARTMENT_NAME} manager cannot be deactivated or demoted.`,
    LAST_ADMIN: 'At least one active admin must remain.',
    ROLE_NOT_FOUND: 'Selected role does not exist.',
    ROLE_INACTIVE: 'Selected role is inactive.',
    USER_NOT_FOUND: 'User not found.',
  }

  return messages[error.message] || null
}
