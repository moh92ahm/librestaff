import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { departmentsTable, rolesTable, usersTable } from '@/db/schema'

export const ROOT_DEPARTMENT_NAME = 'Organization'

export function isRootDepartmentName(name: string | null | undefined) {
  return (name || '').trim().toLowerCase() === ROOT_DEPARTMENT_NAME.toLowerCase()
}

export function isRootDepartment(department: { name: string | null | undefined }) {
  return isRootDepartmentName(department.name)
}

export async function getRootDepartment() {
  const [department] = await db
    .select({
      id: departmentsTable.id,
      name: departmentsTable.name,
      parentDepartmentId: departmentsTable.parentDepartmentId,
      managerUserId: departmentsTable.managerUserId,
      isActive: departmentsTable.isActive,
    })
    .from(departmentsTable)
    .where(eq(departmentsTable.name, ROOT_DEPARTMENT_NAME))
    .limit(1)

  return department || null
}

export async function getRootDepartmentManagerId() {
  return (await getRootDepartment())?.managerUserId || null
}

export async function getProtectedAdminId() {
  const [protectedAdmin] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.isProtectedAdmin, true), eq(usersTable.isActive, true)))
    .limit(1)

  return protectedAdmin?.id || null
}

export async function ensureRootDepartment() {
  const existing = await getRootDepartment()
  if (existing) return existing

  const now = new Date().toISOString()
  const protectedAdminId = await getProtectedAdminId()
  const [created] = await db
    .insert(departmentsTable)
    .values({
      name: ROOT_DEPARTMENT_NAME,
      description: 'Default organization root department',
      parentDepartmentId: null,
      managerUserId: protectedAdminId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning({
      id: departmentsTable.id,
      name: departmentsTable.name,
      parentDepartmentId: departmentsTable.parentDepartmentId,
      managerUserId: departmentsTable.managerUserId,
      isActive: departmentsTable.isActive,
    })

  return created || (await getRootDepartment())
}

export async function getActiveAdminManagerOptions() {
  return db
    .select({
      value: usersTable.id,
      label: usersTable.fullName,
    })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .where(and(eq(usersTable.isActive, true), eq(rolesTable.name, 'admin')))
    .orderBy(usersTable.fullName)
}

export async function isActiveAdminUser(userId: string | null | undefined) {
  if (!userId) return true

  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .where(
      and(eq(usersTable.id, userId), eq(usersTable.isActive, true), eq(rolesTable.name, 'admin')),
    )
    .limit(1)

  return Boolean(user)
}
