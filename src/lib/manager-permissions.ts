import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { departmentsTable, leavesTable, usersTable } from '@/db/schema'
import { getDepartmentIdsWithDescendants } from '@/lib/department-hierarchy'
import { isAdmin, isManager, type User } from '@/lib/rbac'
import { isRootDepartmentName } from '@/lib/root-department'

export function isDepartmentManager(user: User | null | undefined): boolean {
  return isManager(user)
}

export async function getManagedDepartmentIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ departmentId: departmentsTable.id, name: departmentsTable.name })
    .from(departmentsTable)
    .where(eq(departmentsTable.managerUserId, userId))

  if (rows.some((row) => isRootDepartmentName(row.name))) {
    const allDepartments = await db
      .select({ departmentId: departmentsTable.id })
      .from(departmentsTable)
      .where(eq(departmentsTable.isActive, true))

    return allDepartments.map((row) => row.departmentId)
  }

  const directDepartmentIds = rows.map((row) => row.departmentId)
  if (directDepartmentIds.length === 0) return []

  return getDepartmentIdsWithDescendants(directDepartmentIds)
}

export async function getManagedUserIds(managerId: string): Promise<string[]> {
  const departmentIds = await getManagedDepartmentIds(managerId)
  if (departmentIds.length === 0) return []

  const rows = await db
    .select({ userId: usersTable.id })
    .from(usersTable)
    .where(inArray(usersTable.departmentId, departmentIds))

  return Array.from(new Set(rows.map((row) => row.userId)))
}

export async function canManageUser(managerId: string, targetUserId: string): Promise<boolean> {
  if (managerId === targetUserId) return true

  const departmentIds = await getManagedDepartmentIds(managerId)
  if (departmentIds.length === 0) return false

  const [row] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.id, targetUserId), inArray(usersTable.departmentId, departmentIds)))
    .limit(1)

  return Boolean(row)
}

export async function canManageLeave(managerId: string, leaveId: string): Promise<boolean> {
  const leave = await db.query.leavesTable.findFirst({
    where: eq(leavesTable.id, leaveId),
  })

  if (!leave) return false
  return canManageUser(managerId, leave.userId)
}

export function canManageAnnouncementChannel(
  user: User,
  channel: { createdById: string | null },
): boolean {
  if (isAdmin(user)) return true
  return channel.createdById === user.id
}
